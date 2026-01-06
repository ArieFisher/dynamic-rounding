"""
Pandas integration for DynamicRounding.

Optional module - only import if pandas is available.

Usage:
    from dynamic_rounding.pandas import round_dynamic_series
    rounded = round_dynamic_series(df['revenue'])
"""

import math
import re
from typing import Optional, Union

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from . import _round_with_offset, _validate_offset, _preserve_type, DEFAULT_OFFSET

# Regex for parsing formatted strings (JS-compatible)
CLEAN_REGEX = re.compile(r'[$€£¥,\s]')
PARENS_REGEX = re.compile(r'^\((.+)\)$')


def _parse_number(value) -> Optional[float]:
    """
    Parse formatted string to number (JS-compatible).
    
    Handles:
        - Currency symbols: $, €, £, ¥
        - Thousands separators: commas, spaces
        - Accounting negatives: (500) → -500
    
    Returns:
        Parsed float, or None if parsing fails.
    """
    if isinstance(value, (int, float)):
        if math.isfinite(value):
            return float(value)
        return None
    
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        # Remove currency and thousands separators
        cleaned = CLEAN_REGEX.sub('', cleaned)
        # Handle accounting parentheses: (100) → -100
        match = PARENS_REGEX.match(cleaned)
        if match:
            cleaned = '-' + match.group(1)
        try:
            return float(cleaned)
        except ValueError:
            return None
    
    return None


def round_dynamic_series(
    series: "pd.Series",
    offset: Optional[float] = None,
    offset_top: Optional[float] = None,
    offset_other: Optional[float] = None,
    num_top: int = 1,
    enforce_numeric: bool = False,
) -> "pd.Series":
    """
    Round a pandas Series dynamically based on order of magnitude.
    
    If only `offset` is provided, each value is rounded based on its own magnitude.
    If `offset_top` and/or `offset_other` are provided, dataset-aware rounding is used.
    
    Args:
        series: A pandas Series of numbers to round.
        offset: OoM offset for simple mode (default: -0.5).
        offset_top: OoM offset for top magnitude(s) in dataset mode.
        offset_other: OoM offset for other magnitudes in dataset mode.
        num_top: How many top orders of magnitude get offset_top (default: 1).
        enforce_numeric: If True, raise ValueError for unparseable non-numeric values.
            If False (default), unparseable values pass through unchanged.
    
    Returns:
        A new Series with rounded values. Strings like "$1,200" or "(500)" are
        parsed before rounding. Returns int if input was int and result is whole
        number, otherwise returns float.
    
    Examples:
        >>> import pandas as pd
        >>> from dynamic_rounding.pandas import round_dynamic_series
        >>> s = pd.Series([4428910, 983321, 42109])
        >>> round_dynamic_series(s)
        0    4500000
        1    1000000
        2      40000
        dtype: int64
        >>> s = pd.Series(["$1,200", "(500)", "hello"])
        >>> round_dynamic_series(s)
        0    1200.0
        1    -500.0
        2     hello
        dtype: object
    """
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas is required for this function. Install with: pip install pandas")
    
    # Determine mode based on arguments
    dataset_mode = offset_top is not None or offset_other is not None
    
    if dataset_mode:
        return _dataset_mode_series(series, offset_top, offset_other, num_top, enforce_numeric)
    else:
        return _single_mode_series(series, offset, enforce_numeric)


def _single_mode_series(
    series: "pd.Series",
    offset: Optional[float],
    enforce_numeric: bool,
) -> "pd.Series":
    """Round each value based on its own magnitude."""
    if offset is None:
        offset = DEFAULT_OFFSET
    _validate_offset(offset, "offset")
    
    def round_value(val):
        original_val = val
        
        # Handle NaN/None
        if pd.isna(val):
            return val
        
        # Try to parse if not already numeric
        parsed = _parse_number(val)
        
        if parsed is None:
            if enforce_numeric:
                raise ValueError(f"Cannot round non-numeric value: {val}")
            return val  # pass-through
        
        if parsed == 0:
            return _preserve_type(0.0, original_val)
        
        result = _round_with_offset(parsed, offset)
        return _preserve_type(result, original_val)
    
    return series.apply(round_value)


def _dataset_mode_series(
    series: "pd.Series",
    offset_top: Optional[float],
    offset_other: Optional[float],
    num_top: int,
    enforce_numeric: bool,
) -> "pd.Series":
    """Round with dataset-aware heuristic."""
    if offset_top is None:
        offset_top = DEFAULT_OFFSET
    if offset_other is None:
        offset_other = 0.0
    
    _validate_offset(offset_top, "offset_top")
    _validate_offset(offset_other, "offset_other")
    
    # Find max magnitude from non-null, non-zero numeric values
    max_mag = _find_max_magnitude_series(series)
    
    def round_value(val):
        original_val = val
        
        # Handle NaN/None
        if pd.isna(val):
            return val
        
        # Try to parse if not already numeric
        parsed = _parse_number(val)
        
        if parsed is None:
            if enforce_numeric:
                raise ValueError(f"Cannot round non-numeric value: {val}")
            return val  # pass-through
        
        if parsed == 0:
            return _preserve_type(0.0, original_val)
        
        current_mag = math.floor(math.log10(abs(parsed)))
        if max_mag is not None and (max_mag - current_mag) < num_top:
            selected_offset = offset_top
        else:
            selected_offset = offset_other
        
        result = _round_with_offset(parsed, selected_offset)
        return _preserve_type(result, original_val)
    
    return series.apply(round_value)


def _find_max_magnitude_series(series: "pd.Series") -> Optional[int]:
    """Find the maximum order of magnitude in a Series."""
    max_mag = None
    for val in series:
        if pd.isna(val):
            continue
        parsed = _parse_number(val)
        if parsed is not None and parsed != 0:
            mag = math.floor(math.log10(abs(parsed)))
            if max_mag is None or mag > max_mag:
                max_mag = mag
    return max_mag
