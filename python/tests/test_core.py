"""Tests for core dynamic_rounding functionality."""

import pytest
import math
from dynamic_rounding import round_dynamic, __version__


class TestVersion:
    def test_version_exists(self):
        assert __version__ == "0.1.4"


class TestSingleMode:
    """Tests for single value rounding."""
    
    def test_default_offset(self):
        # Default offset is -0.5 (half of current OoM)
        assert round_dynamic(87654321) == 90000000
        assert round_dynamic(4321) == 4500
    
    def test_offset_zero(self):
        # Offset 0 = current OoM
        assert round_dynamic(87654321, offset=0) == 90000000
    
    def test_offset_negative_one(self):
        # Offset -1 = one OoM finer
        assert round_dynamic(87654321, offset=-1) == 88000000
    
    def test_offset_positive_one(self):
        # Offset 1 = one OoM coarser
        assert round_dynamic(87654321, offset=1) == 100000000
    
    def test_offset_negative_one_point_five(self):
        # Offset -1.5 under new sign-aware semantics with the x-floor (Feature 3):
        # the half-step result (87_500_000) is floored by the integer-offset
        # result at trunc(-1.5) = -1, which yields 88_000_000. So the x-floor
        # raises -1.5 up to match -1.
        assert round_dynamic(87654321, offset=-1.5) == 88000000
    
    def test_zero_value(self):
        # Zero returns 0, preserving int type
        assert round_dynamic(0) == 0
        assert isinstance(round_dynamic(0), int)
    
    def test_negative_value(self):
        assert round_dynamic(-87654321) == -90000000
        assert round_dynamic(-4321) == -4500
    
    def test_decimal_value(self):
        assert round_dynamic(0.087654321) == 0.09
        assert math.isclose(round_dynamic(0.0004321), 0.00045, rel_tol=1e-9)
    
    def test_none_value(self):
        assert round_dynamic(None) is None


class TestTypePreservation:
    """Tests for type preservation (int → int when result is whole number)."""
    
    def test_int_input_returns_int(self):
        result = round_dynamic(87654321)
        assert result == 90000000
        assert isinstance(result, int)
    
    def test_int_input_in_list_returns_int(self):
        result = round_dynamic([4428910, 983321])
        assert result[0] == 4500000
        assert isinstance(result[0], int)
    
    def test_float_input_returns_float(self):
        result = round_dynamic(87654321.0)
        assert result == 90000000.0
        assert isinstance(result, float)
    
    def test_fractional_result_returns_float(self):
        # Even with int input, fractional result → float
        result = round_dynamic(0.087654321)  # float input
        assert result == 0.09
        assert isinstance(result, float)


class TestPassThrough:
    """Tests for non-numeric pass-through behavior."""
    
    def test_string_passes_through(self):
        assert round_dynamic("hello") == "hello"
    
    def test_string_in_list_passes_through(self):
        result = round_dynamic([1000, "hello", 2000])
        assert result[0] == 1000
        assert result[1] == "hello"
        assert result[2] == 2000


class TestEnforceNumeric:
    """Tests for enforce_numeric parameter."""
    
    def test_enforce_numeric_raises_on_string(self):
        with pytest.raises(ValueError, match="Cannot round non-numeric"):
            round_dynamic("hello", enforce_numeric=True)
    
    def test_enforce_numeric_raises_on_string_in_list(self):
        with pytest.raises(ValueError, match="Cannot round non-numeric"):
            round_dynamic([1000, "hello", 2000], enforce_numeric=True)
    
    def test_enforce_numeric_allows_numbers(self):
        # Should not raise for valid numbers
        assert round_dynamic(1000, enforce_numeric=True) == 1000
        assert round_dynamic([1000, 2000], enforce_numeric=True) == [1000, 2000]


class TestDatasetMode:
    """Tests for dataset (list) rounding."""
    
    def test_default_offsets(self):
        result = round_dynamic([4428910, 983321, 42109])
        assert result[0] == 4500000  # top magnitude: offset_top=-0.5
        assert result[1] == 1000000  # other: offset_other=-0.5
        assert result[2] == 40000    # other: offset_other=-0.5
    
    def test_custom_offset_top(self):
        result = round_dynamic([4428910, 983321], offset_top=-1)
        assert result[0] == 4400000  # top: offset_top=-1
        assert result[1] == 980000   # other: falls back to offset_top=-1
    
    def test_custom_offset_other(self):
        result = round_dynamic([4428910, 983321], offset_top=-0.5, offset_other=-1)
        assert result[1] == 980000  # finer precision for non-top
    
    def test_num_top(self):
        # With num_top=2, top two orders get offset_top
        result = round_dynamic([4428910, 983321, 42109], offset_top=-0.5, offset_other=0, num_top=2)
        assert result[0] == 4500000  # mag 6, top
        assert result[1] == 1000000  # mag 5, also top (within num_top=2)
        assert result[2] == 40000    # mag 4, not top
    
    def test_empty_list(self):
        assert round_dynamic([]) == []
    
    def test_single_item_list(self):
        result = round_dynamic([87654321])
        assert result == [90000000]
    
    def test_negative_values_in_list(self):
        result = round_dynamic([-4428910, 983321])
        assert result[0] == -4500000
        assert result[1] == 1000000
    
    def test_none_in_list(self):
        result = round_dynamic([4428910, None, 42109])
        assert result[0] == 4500000
        assert result[1] is None
        assert result[2] == 40000


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
        assert result[0] == 4500000


class TestOffsetSignDirection:
    """Under sign-aware semantics, +0.5 and -0.5 step in opposite directions."""

    def test_positive_half_steps_coarser(self):
        # +0.5: target_mag = current_mag + ceil(0.5) = 8, step = 5e7,
        # round(87654321 / 5e7) = 2 -> 1e8.
        assert round_dynamic(87654321, offset=0.5) == 100000000

    def test_negative_half_keeps_legacy_behavior(self):
        # -0.5 preserves the default behavior used historically.
        assert round_dynamic(87654321, offset=-0.5) == 90000000

    def test_positive_and_negative_half_differ(self):
        assert round_dynamic(87654321, offset=0.5) != round_dynamic(87654321, offset=-0.5)


class TestTrailingZeros:
    """Whole-number results with |value| < 10 should return int, not float."""

    def test_whole_number_result_is_int(self):
        result = round_dynamic(1.13, offset=-0.5)
        assert result == 1
        assert isinstance(result, int)

    def test_whole_number_negative_is_int(self):
        result = round_dynamic(-1.13, offset=-0.5)
        assert result == -1
        assert isinstance(result, int)

    def test_whole_number_two_is_int(self):
        result = round_dynamic(1.76, offset=-0.5)
        assert result == 2
        assert isinstance(result, int)

    def test_whole_number_from_exact_input_is_int(self):
        result = round_dynamic(1.0, offset=-0.5)
        assert result == 1
        assert isinstance(result, int)

    def test_fractional_result_stays_float(self):
        result = round_dynamic(1.42, offset=-0.5)
        assert result == 1.5
        assert isinstance(result, float)

    def test_half_step_decimal_input_returns_float(self):
        # Half-step on a value with mag=0: step=0.5*10^0=0.5; 1.42/0.5=2.84 → 3 → 1.5
        result = round_dynamic(1.42, offset=-0.25)
        assert result == 1.5
        assert isinstance(result, float)

    def test_large_float_input_unaffected(self):
        # float input > 10 that rounds to whole number should remain float
        result = round_dynamic(87654321.0)
        assert result == 90000000
        assert isinstance(result, float)

    def test_whole_number_in_list(self):
        result = round_dynamic([1.13, 1.42], offset_top=-0.5)
        assert result[0] == 1
        assert isinstance(result[0], int)
        assert result[1] == 1.5
        assert isinstance(result[1], float)


# ---------------------------------------------------------------------------
# Sprint half-step-floor-python: Features 1 (sign-aware half-step),
# 2 (value-OoM floor), and 3 (X_FLOOR_THRESHOLD-gated x-floor).
# ---------------------------------------------------------------------------


class TestOffsetGrid:
    """27-cell verification grid covering the new sign-aware semantics."""

    @pytest.mark.parametrize("value,offset,expected", [
        (87054321, 2, 10000000),
        (87054321, 1.5, 100000000),
        (87054321, 1, 100000000),
        (87054321, 0.5, 100000000),
        (87054321, 0, 90000000),
        (87054321, -0.5, 85000000),
        (87054321, -1, 87000000),
        (87054321, -1.5, 87000000),
        (87054321, -2, 87100000),
        (47054321, 2, 10000000),
        (47054321, 1.5, 10000000),
        (47054321, 1, 10000000),
        (47054321, 0.5, 50000000),
        (47054321, 0, 50000000),
        (47054321, -0.5, 45000000),
        (47054321, -1, 47000000),
        (47054321, -1.5, 47000000),
        (47054321, -2, 47100000),
        (17054321, 2, 10000000),
        (17054321, 1.5, 10000000),
        (17054321, 1, 10000000),
        (17054321, 0.5, 10000000),
        (17054321, 0, 20000000),
        (17054321, -0.5, 15000000),
        (17054321, -1, 17000000),
        (17054321, -1.5, 17000000),
        (17054321, -2, 17100000),
    ])
    def test_grid(self, value, offset, expected):
        assert round_dynamic(value, offset=offset) == expected


class TestMonotonicity:
    """Sorted inputs must round to a non-decreasing sequence."""

    SORTED = [73, 4591, 63538, 162583, 400000]

    def test_offset_one_preserves_order(self):
        out = [round_dynamic(v, offset=1) for v in self.SORTED]
        assert out == sorted(out)

    def test_offset_half_preserves_order(self):
        out = [round_dynamic(v, offset=0.5) for v in self.SORTED]
        assert out == sorted(out)

    def test_offset_negative_half_preserves_order(self):
        out = [round_dynamic(v, offset=-0.5) for v in self.SORTED]
        assert out == sorted(out)


class TestXFloorThreshold:
    """The module-level X_FLOOR_THRESHOLD constant gates Feature 3."""

    def test_threshold_default_is_one(self):
        import dynamic_rounding
        assert dynamic_rounding.X_FLOOR_THRESHOLD == 1

    def test_x_floor_threshold_can_be_relaxed(self, monkeypatch):
        import dynamic_rounding
        monkeypatch.setattr(dynamic_rounding, "X_FLOOR_THRESHOLD", 0)
        # Relaxing the threshold to 0 makes the x-floor apply even for
        # ±0.5; offset=0.5 then must not round below the offset=0 result.
        assert dynamic_rounding.round_dynamic(17054321, offset=0.5) == 20000000


class TestNegativeHalfRegression:
    """offset=-0.5 must remain unchanged for existing fixtures."""

    @pytest.mark.parametrize("value,expected", [
        (87654321, 90000000),
        (4321, 4500),
        (4428910, 4500000),
        (983321, 1000000),
        (42109, 40000),
        (-87654321, -90000000),
        (-4321, -4500),
    ])
    def test_default_offset_regression(self, value, expected):
        assert round_dynamic(value, offset=-0.5) == expected