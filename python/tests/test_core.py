"""Tests for core dynamic_rounding functionality."""

import pytest
import math
from dynamic_rounding import round_dynamic, __version__


class TestVersion:
    def test_version_exists(self):
        assert __version__ == "0.3.0"


class TestSingleMode:
    """Tests for single value rounding."""
    
    def test_default_offset(self):
        # Default offset is -0.5 (half of current OoM)
        assert round_dynamic(87654321) == 90000000.0
        assert round_dynamic(4321) == 4500.0
    
    def test_offset_zero(self):
        # Offset 0 = current OoM
        assert round_dynamic(87654321, offset=0) == 90000000.0
    
    def test_offset_negative_one(self):
        # Offset -1 = one OoM finer
        assert round_dynamic(87654321, offset=-1) == 88000000.0
    
    def test_offset_positive_one(self):
        # Offset 1 = one OoM coarser
        assert round_dynamic(87654321, offset=1) == 100000000.0
    
    def test_offset_negative_one_point_five(self):
        # Offset -1.5 = half of one OoM finer
        assert round_dynamic(87654321, offset=-1.5) == 87500000.0
    
    def test_zero_value(self):
        assert round_dynamic(0) == 0.0
    
    def test_negative_value(self):
        assert round_dynamic(-87654321) == -90000000.0
        assert round_dynamic(-4321) == -4500.0
    
    def test_decimal_value(self):
        import math
        assert round_dynamic(0.087654321) == 0.09
        assert math.isclose(round_dynamic(0.0004321), 0.00045, rel_tol=1e-9)


class TestDatasetMode:
    """Tests for dataset (list) rounding."""
    
    def test_default_offsets(self):
        result = round_dynamic([4428910, 983321, 42109])
        assert result[0] == 4500000.0  # top magnitude: offset_top=-0.5
        assert result[1] == 1000000.0  # other: offset_other=0
        assert result[2] == 40000.0    # other: offset_other=0
    
    def test_custom_offset_top(self):
        result = round_dynamic([4428910, 983321], offset_top=-1)
        assert result[0] == 4400000.0  # finer precision
    
    def test_custom_offset_other(self):
        result = round_dynamic([4428910, 983321], offset_top=-0.5, offset_other=-1)
        assert result[1] == 980000.0  # finer precision for non-top
    
    def test_num_top(self):
        # With num_top=2, top two orders get offset_top
        result = round_dynamic([4428910, 983321, 42109], offset_top=-0.5, offset_other=0, num_top=2)
        assert result[0] == 4500000.0  # mag 6, top
        assert result[1] == 1000000.0  # mag 5, also top (within num_top=2)
        assert result[2] == 40000.0    # mag 4, not top
    
    def test_empty_list(self):
        assert round_dynamic([]) == []
    
    def test_single_item_list(self):
        result = round_dynamic([87654321])
        assert result == [90000000.0]
    
    def test_negative_values_in_list(self):
        result = round_dynamic([-4428910, 983321])
        assert result[0] == -4500000.0
        assert result[1] == 1000000.0


class TestValidation:
    """Tests for parameter validation."""
    
    def test_offset_too_high(self):
        with pytest.raises(ValueError, match="offset must be between"):
            round_dynamic(1000, offset=21)
    
    def test_offset_too_low(self):
        with pytest.raises(ValueError, match="offset must be between"):
            round_dynamic(1000, offset=-21)
    
    def test_offset_at_limit(self):
        # Should not raise
        round_dynamic(1000, offset=20)
        round_dynamic(1000, offset=-20)
    
    def test_non_numeric_single(self):
        with pytest.raises(ValueError, match="Cannot round non-numeric"):
            round_dynamic("hello")
    
    def test_non_numeric_in_list(self):
        with pytest.raises(ValueError, match="Cannot round non-numeric"):
            round_dynamic([1000, "hello", 2000])


class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_very_large_number(self):
        result = round_dynamic(1e15)
        assert result == 1e15
    
    def test_very_small_number(self):
        result = round_dynamic(1e-10)
        assert math.isclose(result, 1e-10, rel_tol=0.1)
    
    def test_tuple_input(self):
        result = round_dynamic((4428910, 983321))
        assert result[0] == 4500000.0
    
    def test_integer_input(self):
        result = round_dynamic(1000)
        assert result == 1000.0
        assert isinstance(result, float)
    
    def test_float_input(self):
        result = round_dynamic(1000.0)
        assert result == 1000.0


class TestOffsetSymmetry:
    """Test that 0.5 and -0.5 produce same results (as documented)."""
    
    def test_half_offset_symmetry(self):
        assert round_dynamic(87654321, offset=0.5) == round_dynamic(87654321, offset=-0.5)
    
    def test_point_three_symmetry(self):
        assert round_dynamic(87654321, offset=0.3) == round_dynamic(87654321, offset=-0.3)
