"""
Pandas integration for DynamicRounding.

Optional module - only import if pandas is available.

Usage:
    from dynamic_rounding.pandas import round_dynamic_series
    rounded = round_dynamic_series(df['revenue'])
"""

import math
from typing import Optional

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from . import _round_with_offset, _validate_offset, DEFAULT_OFFSET


def round_dynamic_series(
    series: "pd.Series",
    offset: Optional[float] = None,
    offset_top: Optional[float] = None,
    offset_other: Optional[float] = None,
    num_top: int = 1,
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
    
    Returns:
        A new Series with rounded values.
    
    Examples:
        >>> import pandas as pd
        >>> from dynamic_rounding.pandas import round_dynamic_series
        >>> s = pd.Series([4428910, 983321, 42109])
        >>> round_dynamic_series(s)
        0    4500000.0
        1    1000000.0
        2      40000.0
        dtype: float64
    """
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas is required for this function. Install with: pip install pandas")
    
    # Determine mode based on arguments
    dataset_mode = offset_top is not None or offset_other is not None
    
    if dataset_mode:
        return _dataset_mode_series(series, offset_top, offset_other, num_top)
    else:
        return _single_mode_series(series, offset)


def _single_mode_series(series: "pd.Series", offset: Optional[float]) -> "pd.Series":
    """Round each value based on its own magnitude."""
    if offset is None:
        offset = DEFAULT_OFFSET
    _validate_offset(offset, "offset")
    
    def round_value(val):
        if pd.isna(val) or val == 0:
            return val
        try:
            return _round_with_offset(float(val), offset)
        except (ValueError, TypeError):
            return val  # pass through non-numeric
    
    return series.apply(round_value)


def _dataset_mode_series(
    series: "pd.Series",
    offset_top: Optional[float],
    offset_other: Optional[float],
    num_top: int,
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
        if pd.isna(val) or val == 0:
            return val
        try:
            val = float(val)
            current_mag = math.floor(math.log10(abs(val)))
            if max_mag is not None and (max_mag - current_mag) < num_top:
                selected_offset = offset_top
            else:
                selected_offset = offset_other
            return _round_with_offset(val, selected_offset)
        except (ValueError, TypeError):
            return val  # pass through non-numeric
    
    return series.apply(round_value)


def _find_max_magnitude_series(series: "pd.Series") -> Optional[int]:
    """Find the maximum order of magnitude in a Series."""
    max_mag = None
    for val in series:
        if pd.isna(val):
            continue
        try:
            val = float(val)
            if val != 0 and math.isfinite(val):
                mag = math.floor(math.log10(abs(val)))
                if max_mag is None or mag > max_mag:
                    max_mag = mag
        except (ValueError, TypeError):
            continue
    return max_mag
