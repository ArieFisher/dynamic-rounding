"""Runs the shared rounding case table (js/round-dynamic-cases.json) against
the Python port, so this copy stays in agreement with the chrome extension
(the source of truth) and the Google Sheets custom function.

The table is generated from the extension's own parsing/rounding path, not
hand-authored; see js/round-dynamic-cases.json and the sprint that added it.

String-formatted inputs (percent signs, currency symbols, thousands
separators, unicode dashes, accounting parentheses) only get parsed by the
pandas integration's round_dynamic_series: the core round_dynamic() function
never parses strings at all, it only accepts already-numeric values and
passes anything else through unchanged. round_dynamic_series is therefore
the "matching function" for this table.
"""

import json
import numbers
from pathlib import Path

import pytest

pd = pytest.importorskip("pandas")

from dynamic_rounding.pandas import round_dynamic_series

CASES_PATH = Path(__file__).resolve().parents[2] / "js" / "round-dynamic-cases.json"


def _load_case_groups():
    with open(CASES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


CASE_GROUPS = _load_case_groups()


def _flat_cases():
    """Flatten groups into (description, case) pairs for parametrized ids."""
    flat = []
    for group in CASE_GROUPS:
        for case in group["cases"]:
            flat.append((group["description"], case))
    return flat


def _case_id(pair):
    description, case = pair
    return f"{description}: {json.dumps(case['input'])}"


def _assert_matches(actual, expected):
    # round_dynamic_series can hand back numpy scalar types (np.int64,
    # np.float64), which are numbers.Real but not Python int/float.
    #
    # Compare numeric results exactly (==), not with a tolerance. The Python,
    # JS, and chrome-extension implementations run the identical formula, so
    # an exact match is the point: a tolerance here would hide float-noise
    # regressions (e.g. removing the .12g strip in dynamic_rounding's
    # _round_with_offset) instead of catching them.
    if isinstance(expected, numbers.Real) and not isinstance(expected, bool):
        assert isinstance(actual, numbers.Real) and not isinstance(actual, bool)
        assert float(actual) == float(expected)
    else:
        assert actual == expected


@pytest.mark.parametrize("pair", _flat_cases(), ids=_case_id)
def test_shared_case(pair):
    _, case = pair
    input_value = case["input"]
    params = case["params"]
    expected = case["expected"]

    if isinstance(input_value, list):
        # Dataset mode: offset_top presence is what selects dataset mode in
        # round_dynamic_series, so pass it explicitly even when the case
        # relies on its default.
        offset_top = params.get("offset_top", -0.5)
        offset_other = params.get("offset_other", offset_top)
        num_top = params.get("num_top", 1)
        series = pd.Series(input_value)
        result = round_dynamic_series(
            series,
            offset_top=offset_top,
            offset_other=offset_other,
            num_top=num_top,
        )
        actual_list = result.tolist()
        assert len(actual_list) == len(expected)
        for actual, exp in zip(actual_list, expected):
            _assert_matches(actual, exp)
    else:
        # Single mode: the JSON's generic "offset_top" maps to this
        # function's single-mode "offset" keyword.
        offset = params.get("offset_top", -0.5)
        series = pd.Series([input_value])
        result = round_dynamic_series(series, offset=offset)
        _assert_matches(result.iloc[0], expected)
