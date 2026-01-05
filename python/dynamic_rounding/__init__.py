"""
DynamicRounding - Dynamic rounding for readable data
Version: 0.1.1
https://github.com/ArieFisher/dynamic-rounding
MIT License
"""

import math
from typing import Union, List, Optional

__version__ = "0.1.1"

# Constants
DEFAULT_OFFSET = -0.5
VALIDATION_LIMIT = 20
EPSILON = 1e-9


def round_dynamic(
    data: Union[float, int, List[float], List[int]],
    offset: Optional[float] = None,
    offset_top: Optional[float] = None,
    offset_other: Optional[float] = None,
    num_top: int = 1,
) -> Union[float, List[float]]:
    """
    Round numbers dynamically based on order of magnitude.
    
    Modes:
        Single: round_dynamic(value) or round_dynamic(value, offset=-1)
        Dataset: round_dynamic([list of values], offset_top=-0.5, offset_other=0)
    
    Args:
        data: A single number or list of numbers to round.
        offset: OoM offset for single mode (default: -0.5).
        offset_top: OoM offset for top magnitude(s) in dataset mode (default: -0.5).
        offset_other: OoM offset for other magnitudes in dataset mode (default: 0).
        num_top: How many top orders of magnitude get offset_top (default: 1).
    
    Returns:
        Rounded value(s) in same structure as input.
    
    Examples:
        >>> round_dynamic(87654321)
        90000000.0
        >>> round_dynamic(87654321, offset=-1)
        88000000.0
        >>> round_dynamic([4428910, 983321, 42109])
        [4500000.0, 1000000.0, 40000.0]
    """
    if isinstance(data, (list, tuple)):
        return _dataset_mode(list(data), offset_top, offset_other, num_top)
    else:
        return _single_mode(data, offset)


def _single_mode(value: Union[float, int], offset: Optional[float]) -> float:
    """Round a single value based on its own magnitude."""
    if offset is None:
        offset = DEFAULT_OFFSET
    _validate_offset(offset, "offset")
    
    if value is None or value == 0:
        return 0.0
    
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Cannot round non-numeric value: {value}")
    
    return _round_with_offset(value, offset)


def _dataset_mode(
    values: List[Union[float, int]],
    offset_top: Optional[float],
    offset_other: Optional[float],
    num_top: int,
) -> List[float]:
    """Round a list with dataset-aware heuristic."""
    if offset_top is None:
        offset_top = DEFAULT_OFFSET
    if offset_other is None:
        offset_other = 0.0
    
    _validate_offset(offset_top, "offset_top")
    _validate_offset(offset_other, "offset_other")
    
    # Find max magnitude
    max_mag = _find_max_magnitude(values)
    
    # Round each value
    result = []
    for value in values:
        if value is None or value == 0:
            result.append(0.0)
        elif not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f"Cannot round non-numeric value: {value}")
        else:
            current_mag = math.floor(math.log10(abs(value)))
            if max_mag is not None and (max_mag - current_mag) < num_top:
                offset = offset_top
            else:
                offset = offset_other
            result.append(_round_with_offset(value, offset))
    
    return result


def _find_max_magnitude(values: List[Union[float, int, None]]) -> Optional[int]:
    """Find the maximum order of magnitude in a list of numbers."""
    max_mag = None
    for value in values:
        if value is not None and isinstance(value, (int, float)) and value != 0 and math.isfinite(value):
            mag = math.floor(math.log10(abs(value)))
            if max_mag is None or mag > max_mag:
                max_mag = mag
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
    """
    current_mag = math.floor(math.log10(abs(value)))
    
    # Decompose offset into integer part and fraction
    oom_offset = math.trunc(offset)
    fraction = abs(offset - oom_offset) or 1.0
    
    target_mag = current_mag + oom_offset
    rounding_base = (10 ** target_mag) * fraction
    
    # Add epsilon to handle floating point inaccuracies
    return round(value / rounding_base + EPSILON) * rounding_base


def _validate_offset(offset: float, param_name: str) -> None:
    """Validate that offset is within acceptable range."""
    if offset < -VALIDATION_LIMIT or offset > VALIDATION_LIMIT:
        raise ValueError(
            f"{param_name} must be between -{VALIDATION_LIMIT} and {VALIDATION_LIMIT}, got {offset}"
        )