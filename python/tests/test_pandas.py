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
        assert result[0] == 90000000
        assert result[1] == 4500
    
    def test_custom_offset(self):
        s = pd.Series([87654321])
        result = round_dynamic_series(s, offset=-1)
        assert result[0] == 88000000
    
    def test_preserves_index(self):
        s = pd.Series([87654321, 4321], index=['a', 'b'])
        result = round_dynamic_series(s)
        assert list(result.index) == ['a', 'b']
    
    def test_handles_nan(self):
        s = pd.Series([87654321, float('nan'), 4321])
        result = round_dynamic_series(s)
        assert result[0] == 90000000
        assert pd.isna(result[1])
        assert result[2] == 4500
    
    def test_handles_zero(self):
        s = pd.Series([87654321, 0, 4321])
        result = round_dynamic_series(s)
        assert result[1] == 0


class TestTypePreservation:
    """Tests for type preservation in pandas."""
    
    def test_int_series_returns_int(self):
        s = pd.Series([87654321, 4321])
        result = round_dynamic_series(s)
        assert result[0] == 90000000
        assert isinstance(result[0], (int, type(result[0])))  # int or numpy int
    
    def test_float_series_returns_float(self):
        s = pd.Series([87654321.0, 4321.0])
        result = round_dynamic_series(s)
        assert result[0] == 90000000.0


class TestStringParsing:
    """Tests for JS-compatible string parsing in pandas."""
    
    def test_parses_currency_dollar(self):
        s = pd.Series(["$1,200"])
        result = round_dynamic_series(s)
        # 1200 rounds to 1000 with default offset -0.5
        assert result[0] == 1000.0
    
    def test_parses_currency_euro(self):
        s = pd.Series(["€1,200"])
        result = round_dynamic_series(s)
        # 1200 rounds to 1000 with default offset -0.5
        assert result[0] == 1000.0
    
    def test_parses_thousands_separator(self):
        s = pd.Series(["4,428,910"])
        result = round_dynamic_series(s)
        assert result[0] == 4500000.0
    
    def test_parses_accounting_parentheses(self):
        s = pd.Series(["(500)"])
        result = round_dynamic_series(s)
        assert result[0] == -500.0
    
    def test_parses_mixed_formats(self):
        s = pd.Series(["$1,200", "(500)", "4,428,910.41"])
        result = round_dynamic_series(s)
        # Values get rounded with default offset -0.5
        assert result[0] == 1000.0   # 1200 → 1000
        assert result[1] == -500.0   # 500 → 500
        assert result[2] == 4500000.0
    
    def test_unparseable_passes_through(self):
        s = pd.Series(["hello", 1000])
        result = round_dynamic_series(s)
        assert result[0] == "hello"
        assert result[1] == 1000


class TestEnforceNumeric:
    """Tests for enforce_numeric parameter in pandas."""
    
    def test_enforce_numeric_raises_on_unparseable(self):
        s = pd.Series(["hello"])
        with pytest.raises(ValueError, match="Cannot round non-numeric"):
            round_dynamic_series(s, enforce_numeric=True)
    
    def test_enforce_numeric_allows_parseable_strings(self):
        s = pd.Series(["$1,200", "(500)"])
        result = round_dynamic_series(s, enforce_numeric=True)
        # Values get rounded with default offset -0.5
        assert result[0] == 1000.0  # 1200 → 1000
        assert result[1] == -500.0


class TestDatasetModeSeries:
    """Tests for dataset mode with pandas Series."""
    
    def test_default_offsets(self):
        s = pd.Series([4428910, 983321, 42109])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0)
        assert result[0] == 4500000
        assert result[1] == 1000000
        assert result[2] == 40000
    
    def test_triggers_on_offset_top(self):
        # Just providing offset_top should trigger dataset mode
        s = pd.Series([4428910, 983321])
        result = round_dynamic_series(s, offset_top=-1)
        assert result[0] == 4400000
    
    def test_triggers_on_offset_other(self):
        # Just providing offset_other should trigger dataset mode
        s = pd.Series([4428910, 983321])
        result = round_dynamic_series(s, offset_other=-1)
        assert result[1] == 980000
    
    def test_num_top(self):
        s = pd.Series([4428910, 983321, 42109])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0, num_top=2)
        assert result[0] == 4500000  # top
        assert result[1] == 1000000  # also top with num_top=2
        assert result[2] == 40000    # not top
    
    def test_string_parsing_in_dataset_mode(self):
        s = pd.Series(["$4,428,910", "$983,321", "$42,109"])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0)
        assert result[0] == 4500000.0
        assert result[1] == 1000000.0
        assert result[2] == 40000.0


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
    
    def test_negative_values(self):
        s = pd.Series([-4428910, 983321])
        result = round_dynamic_series(s, offset_top=-0.5, offset_other=0)
        assert result[0] == -4500000
        assert result[1] == 1000000


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
