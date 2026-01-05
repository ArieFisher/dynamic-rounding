"""Tests for pandas integration."""

import pytest

# Skip all tests if pandas not installed
pd = pytest.importorskip("pandas")

from dynamic_rounding.pandas import round_dynamic_series


class TestSingleModeSeries:
    """Tests for single mode with pandas Series."""
    
    def test_default_offset(self):
        s = pd.Series([87654321, 4321])
        result = round_dynamic_series(s)
        assert result[0] == 90000000.0
        assert result[1] == 4500.0
    
    def test_custom_offset(self):
        s = pd.Series([87654321])
        result = round_dynamic_series(s, offset=-1)
        assert result[0] == 88000000.0
    
    def test_preserves_index(self):
        s = pd.Series([87654321, 4321], index=['a', 'b'])
        result = round_dynamic_series(s)
        assert list(result.index) == ['a', 'b']
    
    def test_handles_nan(self):
        s = pd.Series([87654321, float('nan'), 4321])
        result = round_dynamic_series(s)
        assert result[0] == 90000000.0
        assert pd.isna(result[1])
        assert result[2] == 4500.0
    
    def test_handles_zero(self):
        s = pd.Series([87654321, 0, 4321])
        result = round_dynamic_series(s)
        assert result[1] == 0


class TestDatasetModeSeries:
    """Tests for dataset mode with pandas Series."""
    
    def test_default_offsets(self):
        s = pd.Series([4428910, 983321, 42109])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0)
        assert result[0] == 4500000.0
        assert result[1] == 1000000.0
        assert result[2] == 40000.0
    
    def test_triggers_on_offset_top(self):
        # Just providing offset_top should trigger dataset mode
        s = pd.Series([4428910, 983321])
        result = round_dynamic_series(s, offset_top=-1)
        assert result[0] == 4400000.0
    
    def test_triggers_on_offset_other(self):
        # Just providing offset_other should trigger dataset mode
        s = pd.Series([4428910, 983321])
        result = round_dynamic_series(s, offset_other=-1)
        assert result[1] == 980000.0
    
    def test_num_top(self):
        s = pd.Series([4428910, 983321, 42109])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0, num_top=2)
        assert result[0] == 4500000.0  # top
        assert result[1] == 1000000.0  # also top with num_top=2
        assert result[2] == 40000.0    # not top


class TestEdgeCases:
    """Tests for edge cases with pandas."""
    
    def test_empty_series(self):
        s = pd.Series([], dtype=float)
        result = round_dynamic_series(s)
        assert len(result) == 0
    
    def test_all_nan_series(self):
        s = pd.Series([float('nan'), float('nan')])
        result = round_dynamic_series(s)
        assert pd.isna(result[0])
        assert pd.isna(result[1])
    
    def test_mixed_types_passthrough(self):
        # Non-numeric values should pass through in single mode
        s = pd.Series([1000, 'text', 2000])
        result = round_dynamic_series(s, offset=0)
        assert result[0] == 1000.0
        assert result[1] == 'text'
        assert result[2] == 2000.0
    
    def test_negative_values(self):
        s = pd.Series([-4428910, 983321])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0)
        assert result[0] == -4500000.0
        assert result[1] == 1000000.0


class TestReturnType:
    """Tests for return type behavior."""
    
    def test_returns_series(self):
        s = pd.Series([1000, 2000])
        result = round_dynamic_series(s)
        assert isinstance(result, pd.Series)
    
    def test_original_unchanged(self):
        s = pd.Series([87654321, 4321])
        original_values = s.tolist()
        _ = round_dynamic_series(s)
        assert s.tolist() == original_values
