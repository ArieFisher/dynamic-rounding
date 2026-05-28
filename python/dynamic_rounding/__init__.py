"""
DynamicRounding - Dynamic rounding for readable data
Version: 0.1.4
https://github.com/ArieFisher/dynamic-rounding
MIT License
"""

import math
from typing import Union, List, Optional, Any

__version__ = "0.1.4"

# Constants
DEFAULT_OFFSET = -0.5
X_FLOOR_THRESHOLD: float = 1
VALIDATION_LIMIT = 20
EPSILON = 1e-9


def round_dynamic(
    data: Union[float, int, List[Any], Any],
    offset: Optional[float] = None,
    offset_top: Optional[float] = None,
    offset_other: Optional[float] = None,
    num_top: int = 1,
    enforce_numeric: bool = False,
) -> Union[int, float, None, List[Any], Any]:
    """
    Round numbers dynamically based on order of magnitude.
    
    Modes:
        Single: round_dynamic(value) or round_dynamic(value, offset=-1)
        Dataset: round_dynamic([list of values], offset_top=-0.5, offset_other=-0.5)
    
    Args:
        data: A single number or list of numbers to round.
        offset: OoM offset for single mode (default: -0.5).
        offset_top: OoM offset for top magnitude(s) in dataset mode (default: -0.5).
        offset_other: OoM offset for other magnitudes in dataset mode (default: -0.5).
        num_top: How many top orders of magnitude get offset_top (default: 1).
        enforce_numeric: If True, raise ValueError for non-numeric values.
            If False (default), non-numeric values pass through unchanged.
    
    Returns:
        Rounded value(s). Returns int if input was int and result is whole number,
        otherwise returns float. Non-numeric values pass through unchanged unless
        enforce_numeric=True.
    
    Examples:
        >>> round_dynamic(87654321)
        90000000
        >>> round_dynamic(87654321, offset=-1)
        88000000
        >>> round_dynamic([4428910, 983321, 42109])
        [4500000, 1000000, 40000]
        >>> round_dynamic("hello")  # pass-through
        'hello'
    """
    if isinstance(data, (list, tuple)):
        return _dataset_mode(list(data), offset_top, offset_other, num_top, enforce_numeric)
    else:
        return _single_mode(data, offset, enforce_numeric)


def _single_mode(
    value: Any,
    offset: Optional[float],
    enforce_numeric: bool,
) -> Union[int, float, None, Any]:
    """Round a single value based on its own magnitude."""
    if offset is None:
        offset = DEFAULT_OFFSET
    _validate_offset(offset, "offset")
    
    if value is None:
        return None
    
    if value == 0:
        return _preserve_type(0.0, value)
    
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        if enforce_numeric:
            raise ValueError(f"Cannot round non-numeric value: {value}")
        return value  # pass-through
    
    result = _round_with_offset(value, offset)
    return _preserve_type(result, value)


def _dataset_mode(
    values: List[Any],
    offset_top: Optional[float],
    offset_other: Optional[float],
    num_top: int,
    enforce_numeric: bool,
) -> List[Any]:
    """Round a list with dataset-aware heuristic."""
    if offset_top is None:
        offset_top = DEFAULT_OFFSET
    if offset_other is None:
        offset_other = offset_top
    
    _validate_offset(offset_top, "offset_top")
    _validate_offset(offset_other, "offset_other")
    
    # Find max magnitude
    max_mag = _find_max_magnitude(values)
    
    # Round each value
    result = []
    for value in values:
        if value is None:
            result.append(None)
        elif value == 0:
            result.append(_preserve_type(0.0, value))
        elif not isinstance(value, (int, float)) or not math.isfinite(value):
            if enforce_numeric:
                raise ValueError(f"Cannot round non-numeric value: {value}")
            result.append(value)  # pass-through
        else:
            current_mag = math.floor(math.log10(abs(value)))
            if max_mag is not None and (max_mag - current_mag) < num_top:
                selected_offset = offset_top
            else:
                selected_offset = offset_other
            rounded = _round_with_offset(value, selected_offset)
            result.append(_preserve_type(rounded, value))
    
    return result


def _find_max_magnitude(values: List[Any]) -> Optional[int]:
    """Find the maximum order of magnitude in a list of numbers."""
    max_mag = None
    for value in values:
        if value is not None and isinstance(value, (int, float)) and value != 0:
            try:
                if math.isfinite(value):
                    mag = math.floor(math.log10(abs(value)))
                    if max_mag is None or mag > max_mag:
                        max_mag = mag
            except (ValueError, TypeError):
                continue
    return max_mag


def _round_with_offset(value: float, offset: float) -> float:
    """
    Round a number using the offset model.

    offset = OoM offset + optional fraction
        0 = current OoM
        -1 = one OoM finer
        1 = one OoM coarser
        0.5 = half of current OoM (same as -0.5)
        -1.5 = half of one OoM finer

    Sign-aware: rounding is performed on the absolute value, then the sign is
    re-applied. A value-OoM floor prevents results from dropping below the
    current order of magnitude, so a positive input never rounds toward zero
    past its own OoM. For half-steps with a large integer offset component
    (|trunc(offset)| >= X_FLOOR_THRESHOLD), an additional x-floor is applied
    so that a half-step never rounds finer than the corresponding integer
    offset would.
    """
    if value == 0:
        return 0

    sign = -1 if value < 0 else 1
    absval = abs(value)
    current_mag = math.floor(math.log10(absval))

    if float(offset).is_integer():
        target_mag = current_mag + int(offset)
        step = 10 ** target_mag
    else:  # general fractional offset
        target_mag = current_mag + math.ceil(offset)
        f = abs(offset - math.trunc(offset))  # fractional magnitude in (0, 1)
        step = f * (10 ** target_mag)

    raw = round(absval / step + EPSILON) * step
    floor_oom = 10 ** current_mag  # Feature 2: value-OoM floor

    result = max(raw, floor_oom)

    # Feature 3: x-floor for fractional offsets with large integer part
    if not float(offset).is_integer():
        x_int = math.trunc(offset)
        if abs(x_int) >= X_FLOOR_THRESHOLD:
            floor_x = _round_with_offset(absval, x_int)
            result = max(result, abs(floor_x))

    return sign * result


def _preserve_type(result: float, original_value: Any) -> Union[int, float]:
    """
    Preserve input type when possible, and trim trailing zeros for small results.

    Returns int if:
        - original_value was int and result is a whole number, OR
        - |result| < 10 and result is a whole number (trim trailing zeros)
    Otherwise returns float.
    """
    if isinstance(original_value, int) and result == int(result):
        return int(result)
    if abs(result) < 10 and result == int(result):
        return int(result)
    return result


def _validate_offset(offset: float, param_name: str) -> None:
    """Validate that offset is within acceptable range."""
    if offset < -VALIDATION_LIMIT or offset > VALIDATION_LIMIT:
        raise ValueError(
            f"{param_name} must be between -{VALIDATION_LIMIT} and {VALIDATION_LIMIT}, got {offset}"
        )