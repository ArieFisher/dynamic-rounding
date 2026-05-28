/**
 * Test suite for ROUND_DYNAMIC v0.2.x
 * Run: node tests.js
 */

const fs = require('fs');
const path = require('path');

// Load round_dynamic.js (written for Google Apps Script, runs in Node)
const code = fs.readFileSync(path.join(__dirname, 'round_dynamic.js'), 'utf8');
eval(code);

// Test runner
let passed = 0;
let failed = 0;
const failures = [];

function test(name, actual, expected) {
    // Handle special cases
    if (Number.isNaN(expected) && Number.isNaN(actual)) {
        passed++;
        return;
    }
    if (expected === Infinity && actual === Infinity) {
        passed++;
        return;
    }
    if (expected === -Infinity && actual === -Infinity) {
        passed++;
        return;
    }

    // Handle floating point comparison
    const isEqual = typeof expected === 'number' && typeof actual === 'number'
        ? Math.abs(actual - expected) < 0.0001
        : actual === expected;

    if (isEqual) {
        passed++;
    } else {
        failed++;
        failures.push({ name, actual, expected });
    }
}

function testThrows(name, fn, expectedMessage) {
    try {
        fn();
        failed++;
        failures.push({ name, actual: 'no error thrown', expected: 'Error: ' + expectedMessage });
    } catch (e) {
        if (e.message.includes(expectedMessage)) {
            passed++;
        } else {
            failed++;
            failures.push({ name, actual: e.message, expected: expectedMessage });
        }
    }
}

function testArray(name, actual, expected) {
    // Flatten 2D arrays for comparison
    const flatActual = actual.flat();
    const flatExpected = expected.flat();

    if (flatActual.length !== flatExpected.length) {
        failed++;
        failures.push({ name, actual: `length ${flatActual.length}`, expected: `length ${flatExpected.length}` });
        return;
    }

    for (let i = 0; i < flatActual.length; i++) {
        const isEqual = typeof flatExpected[i] === 'number' && typeof flatActual[i] === 'number'
            ? Math.abs(flatActual[i] - flatExpected[i]) < 0.0001
            : flatActual[i] === flatExpected[i];

        if (!isEqual) {
            failed++;
            failures.push({ name: `${name}[${i}]`, actual: flatActual[i], expected: flatExpected[i] });
            return;
        }
    }
    passed++;
}

// =============================================================================
// SINGLE MODE TESTS
// =============================================================================

console.log('\n=== Single Mode ===\n');

// Offset variations with 87,654,321
test('87654321, offset=default', ROUND_DYNAMIC(87654321), 90000000);
test('87654321, offset=0', ROUND_DYNAMIC(87654321, 0), 90000000);
test('87654321, offset=1', ROUND_DYNAMIC(87654321, 1), 100000000);
test('87654321, offset=-1', ROUND_DYNAMIC(87654321, -1), 88000000);
test('87654321, offset=-2', ROUND_DYNAMIC(87654321, -2), 87700000);
// +0.5 under new semantics: step = 0.5 * 10^(cm+1). For 87654321 (cm=7), step=5e7.
// raw = round(87654321/5e7)*5e7 = round(1.75)*5e7 = 2*5e7 = 1e8. floor_oom=1e7. result=1e8.
// |trunc(0.5)|=0 < X_FLOOR_THRESHOLD=1, so x-floor is skipped.
test('87654321, offset=0.5', ROUND_DYNAMIC(87654321, 0.5), 100000000);
// -0.5 preserves prior behavior: step = 0.5 * 10^cm = 5e6.
// raw = round(87654321/5e6)*5e6 = 18*5e6 = 90000000. floor_oom=1e7. result=90000000.
test('87654321, offset=-0.5', ROUND_DYNAMIC(87654321, -0.5), 90000000);
// -1.5: step = 0.5 * 10^(cm-1) = 500000. raw=87500000. floor_oom=1e7. x-floor (x_int=-1): rd(v,-1)=87700000? cm=7, step=1e6, raw=round(87.654)*1e6=88e6. So floor_x=88M. result=max(87.5M, 88M)=88M.
test('87654321, offset=-1.5', ROUND_DYNAMIC(87654321, -1.5), 88000000);
// -2.5: step = 0.5 * 10^(cm-2) = 50000. raw = round(87654321/50000)*50000 = 1753*50000 = 87650000. x-floor x_int=-2: rd(v,-2)=87700000 (step=1e5, round(876.54)=877, 877*1e5=87700000). result=max(87650000, 87700000)=87700000.
test('87654321, offset=-2.5', ROUND_DYNAMIC(87654321, -2.5), 87700000);

// Various magnitudes - explicit offset=0
test('4308910, offset=0', ROUND_DYNAMIC(4308910, 0), 4000000);
test('4308910, offset=-0.5', ROUND_DYNAMIC(4308910, -0.5), 4500000);
test('42109, offset=0', ROUND_DYNAMIC(42109, 0), 40000);
test('42109, offset=-0.5', ROUND_DYNAMIC(42109, -0.5), 40000);
test('1234, offset=0', ROUND_DYNAMIC(1234, 0), 1000);
test('1234, offset=-1', ROUND_DYNAMIC(1234, -1), 1200);
test('0.35, offset=0', ROUND_DYNAMIC(0.35, 0), 0.4);
test('0.35, offset=-0.5', ROUND_DYNAMIC(0.35, -0.5), 0.35);
test('0.35, offset=-1', ROUND_DYNAMIC(0.35, -1), 0.35);
test('0.047, offset=0', ROUND_DYNAMIC(0.047, 0), 0.05);
test('0.0083, offset=0', ROUND_DYNAMIC(0.0083, 0), 0.008);

// Default offset (now -0.5)
test('4308910, default', ROUND_DYNAMIC(4308910), 4500000);
test('0.35, default', ROUND_DYNAMIC(0.35), 0.35);
test('0.047, default', ROUND_DYNAMIC(0.047), 0.045);
test('0.0083, default', ROUND_DYNAMIC(0.0083), 0.0085);

// Edge cases
test('zero', ROUND_DYNAMIC(0), 0);
test('empty string', ROUND_DYNAMIC(''), '');
test('null', ROUND_DYNAMIC(null), '');
test('non-numeric string', ROUND_DYNAMIC('Cloud CDN'), 'Cloud CDN');
test('negative -4308910', ROUND_DYNAMIC(-4308910), -4500000);
test('negative -42.66', ROUND_DYNAMIC(-42.66), -45);

// String parsing (uses default offset=-0.5)
test('currency $1234.56', ROUND_DYNAMIC('$1,234.56'), 1000);
test('commas 1,234,567', ROUND_DYNAMIC('1,234,567'), 1000000);
test('accounting (500)', ROUND_DYNAMIC('(500)'), -500);
test('euro €1234', ROUND_DYNAMIC('€1,234'), 1000);

// =============================================================================
// DATASET MODE TESTS
// =============================================================================

console.log('=== Dataset Mode ===\n');

// GCP dataset (max magnitude = 6)
const gcpData = [
    [4428910.41],
    [3892105.59],
    [1011204.89],
    [983321.11],
    [824479.02],
    [84211],
    [42109.45],
    [21550.20],
    [1510.44],
    [1127.10],
    [67.44],
    [42.66]
];

// Defaults: offset_top=-0.5, offset_other=-0.5, num_top=1
// Mag 6 gets offset=-0.5, others get offset=-0.5
testArray('GCP defaults', ROUND_DYNAMIC(gcpData), [
    [4500000],   // mag 6, offset=-0.5, base=500k
    [4000000],   // mag 6, offset=-0.5
    [1000000],   // mag 6, offset=-0.5
    [1000000],   // mag 5, offset=-0.5
    [800000],    // mag 5, offset=-0.5
    [85000],     // mag 4, offset=-0.5
    [40000],     // mag 4, offset=-0.5
    [20000],     // mag 4, offset=-0.5
    [1500],      // mag 3, offset=-0.5
    [1000],      // mag 3, offset=-0.5
    [65],        // mag 1, offset=-0.5
    [45]         // mag 1, offset=-0.5
]);

// offset_top=-1, offset_other falls back to offset_top=-1
testArray('GCP offset_other fallback', ROUND_DYNAMIC(gcpData, -1), [
    [4400000],
    [3900000],
    [1000000],
    [980000],
    [820000],
    [84000],
    [42000],
    [22000],
    [1500],
    [1100],
    [67],
    [43]
]);

// offset_top=-1, offset_other=0, num_top=1
// Mag 6 gets offset=-1 (base=100k), others get offset=0
testArray('GCP offset_top=-1', ROUND_DYNAMIC(gcpData, -1, 0, 1), [
    [4400000],   // mag 6, offset=-1, base=100k
    [3900000],
    [1000000],
    [1000000],   // mag 5, offset=0
    [800000],
    [80000],
    [40000],
    [20000],
    [2000],
    [1000],
    [70],
    [40]
]);

// offset_top=-0.5, offset_other=-1, num_top=1
// Mag 6 gets offset=-0.5, others get offset=-1 (one OoM finer)
testArray('GCP offset_other=-1', ROUND_DYNAMIC(gcpData, -0.5, -1, 1), [
    [4500000],   // mag 6, offset=-0.5
    [4000000],
    [1000000],
    [980000],    // mag 5, offset=-1, base=10k
    [820000],
    [84000],     // mag 4, offset=-1, base=1k
    [42000],
    [22000],
    [1500],      // mag 3, offset=-1, base=100
    [1100],
    [67],        // mag 1, offset=-1, base=1
    [43]
]);

// offset_top=-0.5, offset_other=0, num_top=2
// Mag 6 AND mag 5 get offset=-0.5, others get offset=0
testArray('GCP num_top=2', ROUND_DYNAMIC(gcpData, -0.5, 0, 2), [
    [4500000],   // mag 6, offset=-0.5
    [4000000],
    [1000000],
    [1000000],   // mag 5, offset=-0.5, base=50k
    [800000],    // mag 5, offset=-0.5
    [80000],     // mag 4, offset=0
    [40000],
    [20000],
    [2000],
    [1000],
    [70],
    [40]
]);

// Decimals dataset (max magnitude = -1)
const decimalsData = [
    [0.35],
    [0.12],
    [0.047],
    [0.0083]
];

// Defaults: offset_top=-0.5, offset_other=-0.5, num_top=1
// Mag -1 gets offset=-0.5, others get offset=-0.5
testArray('Decimals defaults', ROUND_DYNAMIC(decimalsData), [
    [0.35],      // mag -1, offset=-0.5, base=0.05
    [0.10],      // mag -1, offset=-0.5
    [0.045],      // mag -2, offset=-0.5, base=0.005
    [0.0085]      // mag -3, offset=-0.5, base=0.0005
]);

// Mixed data with non-numeric values
const mixedData = [
    [4428910.41],
    ['Cloud CDN'],
    [0],
    [''],
    [42.66]
];

testArray('Mixed data passthrough', ROUND_DYNAMIC(mixedData), [
    [4500000],
    ['Cloud CDN'],
    [0],
    [''],
    [45]
]);



// =============================================================================
// DATE/TIME HANDLING TESTS
// =============================================================================

console.log('=== Date/Time Handling ===\n');

// Dates - Google Sheets passes these as Date objects
const date1 = new Date('2024-01-15');
const date2 = new Date('2024-12-30');
const time1 = new Date('1970-01-01T09:30:00');  // Time only (Sheets uses epoch date)
const time2 = new Date('1970-01-01T14:45:30');
const datetime1 = new Date('2024-06-15T10:30:00');

// Single-value mode with dates
test('Date passthrough (single)', ROUND_DYNAMIC(date1), date1);
test('Time passthrough (single)', ROUND_DYNAMIC(time1), time1);
test('DateTime passthrough (single)', ROUND_DYNAMIC(datetime1), datetime1);

// Array mode with dates mixed in
const mixedWithDates = [
    [4428910.41],
    [date1],
    [1000],
    [time1],
    [42.66]
];

const mixedWithDatesResult = ROUND_DYNAMIC(mixedWithDates);
test('Array: number rounds', mixedWithDatesResult[0][0], 4500000);
test('Array: date passthrough', mixedWithDatesResult[1][0], date1);
test('Array: number rounds 2', mixedWithDatesResult[2][0], 1000);
test('Array: time passthrough', mixedWithDatesResult[3][0], time1);
test('Array: number rounds 3', mixedWithDatesResult[4][0], 45);



// =============================================================================
// BOUNDARY TESTS
// =============================================================================

console.log('=== Boundary Cases ===\n');

// Numbers at exact powers of 10
test('Exact 1000, offset=0', ROUND_DYNAMIC(1000, 0), 1000);
test('Exact 1000, offset=-1', ROUND_DYNAMIC(1000, -1), 1000);
test('Exact 10000000, offset=0', ROUND_DYNAMIC(10000000, 0), 10000000);

// Just above/below magnitude boundaries
test('999 (mag 2), offset=0', ROUND_DYNAMIC(999, 0), 1000);
test('1001 (mag 3), offset=0', ROUND_DYNAMIC(1001, 0), 1000);
test('9999 (mag 3), offset=0', ROUND_DYNAMIC(9999, 0), 10000);
test('10001 (mag 4), offset=0', ROUND_DYNAMIC(10001, 0), 10000);

// Very small numbers
test('0.001, offset=0', ROUND_DYNAMIC(0.001, 0), 0.001);
test('0.0015, offset=0', ROUND_DYNAMIC(0.0015, 0), 0.002);
test('0.00099, offset=0', ROUND_DYNAMIC(0.00099, 0), 0.001);

// Very large numbers
test('999999999, offset=0', ROUND_DYNAMIC(999999999, 0), 1000000000);
test('1000000001, offset=0', ROUND_DYNAMIC(1000000001, 0), 1000000000);

// Sign-aware half-step: +0.5 and -0.5 are now distinct steps (Feature 1).
// +0.5 → step at next-coarser OoM; -0.5 → step at current OoM.
test('87654321 offset=+0.5 distinct from -0.5',
    ROUND_DYNAMIC(87654321, 0.5) !== ROUND_DYNAMIC(87654321, -0.5), true);
test('87654321 offset=+0.5 > offset=-0.5',
    ROUND_DYNAMIC(87654321, 0.5) > ROUND_DYNAMIC(87654321, -0.5), true);

// Negative numbers at boundaries
test('-999, offset=0', ROUND_DYNAMIC(-999, 0), -1000);
test('-1001, offset=0', ROUND_DYNAMIC(-1001, 0), -1000);

// Floating point edge case (the epsilon fix) - tests offset=0 specifically
test('0.35 rounds to 0.4 not 0.3', ROUND_DYNAMIC(0.35, 0), 0.4);
test('0.45 rounds to 0.5', ROUND_DYNAMIC(0.45, 0), 0.5);
test('0.25 rounds to 0.3', ROUND_DYNAMIC(0.25, 0), 0.3);

// =============================================================================
// GRAIN VALIDATION TESTS
// =============================================================================

console.log('=== Offset Validation ===\n');

// Valid boundary values (should not throw)
test('offset=-20 valid', ROUND_DYNAMIC(1000, -20), 1000);

// Invalid values (should throw)
testThrows('offset=21 throws', () => ROUND_DYNAMIC(1000, 21), 'offset must be between -20 and 20');
testThrows('offset=-21 throws', () => ROUND_DYNAMIC(1000, -21), 'offset must be between -20 and 20');
testThrows('offset=100 throws', () => ROUND_DYNAMIC(1000, 100), 'offset must be between -20 and 20');
testThrows('offset=-100 throws', () => ROUND_DYNAMIC(1000, -100), 'offset must be between -20 and 20');

// Large offsets no longer collapse to 0 — Feature 2 floors at value's own OoM.
// 9999 has cm=3 → floor_oom=1000; raw rounds to 0; result = max(0, 1000) = 1000.
test('offset=2 floors at value OoM', ROUND_DYNAMIC(9999, 2), 1000);
// 9999, offset=2.5: half-step, target=cm+ceil(2.5)=6, step=5e5. raw=0. floor_oom=1000. x-floor: |trunc(2.5)|=2>=1, x_int=2, floor_x=rd(9999,2)=1000. result=1000.
test('offset=2.5 floors at value OoM', ROUND_DYNAMIC(9999, 2.5), 1000);
test('offset=5 floors at value OoM', ROUND_DYNAMIC(1e10, 5), 1e10);
test('offset=20 floors at value OoM', ROUND_DYNAMIC(1e20, 20), 1e20);
test('offset=2 negative input floors at value OoM', ROUND_DYNAMIC(-9999, 2), -1000);

// Array mode validation
testThrows('array offset_top=25 throws', () => ROUND_DYNAMIC([[1000]], 25, 0, 1), 'offset_top must be between -20 and 20');
testThrows('array offset_other=25 throws', () => ROUND_DYNAMIC([[1000]], 0, 25, 1), 'offset_other must be between -20 and 20');



// =============================================================================
// ADDITIONAL EDGE CASES
// =============================================================================

console.log('=== Additional Edge Cases ===\n');

// Undefined as explicit value (passes through)
test('undefined value', ROUND_DYNAMIC(undefined), undefined);

// NaN and Infinity
test('NaN passthrough', ROUND_DYNAMIC(NaN), NaN);
test('Infinity passthrough', ROUND_DYNAMIC(Infinity), Infinity);
test('-Infinity passthrough', ROUND_DYNAMIC(-Infinity), -Infinity);

// JS precision limits
test('Very large 1e15', ROUND_DYNAMIC(1e15), 1e15);
test('Very large 9.87e14', ROUND_DYNAMIC(9.87e14), 1e15);
test('Very small 1e-10', ROUND_DYNAMIC(1e-10), 1e-10);
test('Very small 9.5e-11', ROUND_DYNAMIC(9.5e-11), 1e-10);
test('Near MAX_SAFE_INTEGER', ROUND_DYNAMIC(9007199254740991), 9000000000000000);

// Empty array
testArray('Empty array', ROUND_DYNAMIC([]), []);

// =============================================================================
// TRAILING ZEROS TESTS
// =============================================================================

console.log('=== Trailing Zeros (|result| < 10) ===\n');

// Whole-number results between -10 and 10 must be integers (no trailing zeros).
// Under new semantics, +0.5 steps at the NEXT-coarser OoM, and Feature 2 floors
// at the value's own OoM, so for v in [1,10) most +0.5 / +0.25 calls land at 1.
test('1.13 offset=0.5 → integer 1', ROUND_DYNAMIC(1.13, 0.5) === 1, true);
test('1.76 offset=0.5 → integer 1 (floor_oom)', ROUND_DYNAMIC(1.76, 0.5) === 1, true);
test('1.0 offset=0.5 → integer 1', ROUND_DYNAMIC(1.0, 0.5) === 1, true);
test('1.0 offset=0.25 → integer 1', ROUND_DYNAMIC(1.0, 0.25) === 1, true);
test('negative -1.13 offset=0.5 → integer -1', ROUND_DYNAMIC(-1.13, 0.5) === -1, true);

// -0.5 (and other negative half-steps) preserves prior trailing-zero / float behavior.
test('1.42 offset=-0.5 → 1.5 (float)', ROUND_DYNAMIC(1.42, -0.5), 1.5);
test('1.32 offset=-0.5 → 1.5 (float)', ROUND_DYNAMIC(1.32, -0.5), 1.5);
// +0.25/+0.5 on small values now collapse to floor_oom=1 (integer).
test('1.13 offset=0.25 → integer 1', ROUND_DYNAMIC(1.13, 0.25) === 1, true);
test('1.42 offset=0.25 → integer 1', ROUND_DYNAMIC(1.42, 0.25) === 1, true);

// Array with only non-numerics (max_mag will be null)
const nonNumericArray = [
    ['Cloud CDN'],
    ['BigQuery'],
    ['']
];
testArray('Non-numeric only array', ROUND_DYNAMIC(nonNumericArray), [
    ['Cloud CDN'],
    ['BigQuery'],
    ['']
]);

// 1D array (row vector) - Sheets can pass this way
const rowVector = [4428910.41, 983321.11, 42.66];
testArray('1D row vector', ROUND_DYNAMIC(rowVector), [4500000, 1000000, 45]);

// 2D single row
const singleRow = [[4428910.41, 983321.11, 42.66]];
testArray('2D single row', ROUND_DYNAMIC(singleRow), [[4500000, 1000000, 45]]);

// 2D multi-column
const multiColumn = [
    [4428910.41, 100],
    [983321.11, 50],
    [42.66, 25]
];
// max_mag = 6 (from 4428910.41)
testArray('2D multi-column', ROUND_DYNAMIC(multiColumn), [
    [4500000, 100],
    [1000000, 50],
    [45, 25]
]);



// Sort-safe with single value as "range" - not valid usage, omitting test

// =============================================================================
// HALF-STEP + FLOOR SEMANTICS (Features 1, 2, 3)
// =============================================================================

console.log('=== Half-step + Floor Semantics ===\n');

// 27-cell verification grid from the sprint plan:
// {87,054,321; 47,054,321; 17,054,321} × {+2, +1.5, +1, +0.5, 0, -0.5, -1, -1.5, -2}
const gridCases = [
    // [value, offset, expected]
    [87054321,  2,    10000000],
    [87054321,  1.5,  100000000],
    [87054321,  1,    100000000],
    [87054321,  0.5,  100000000],
    [87054321,  0,    90000000],
    [87054321, -0.5,  85000000],
    [87054321, -1,    87000000],
    [87054321, -1.5,  87000000],
    [87054321, -2,    87100000],

    [47054321,  2,    10000000],
    [47054321,  1.5,  10000000],
    [47054321,  1,    10000000],
    [47054321,  0.5,  50000000],
    [47054321,  0,    50000000],
    [47054321, -0.5,  45000000],
    [47054321, -1,    47000000],
    [47054321, -1.5,  47000000],
    [47054321, -2,    47100000],

    [17054321,  2,    10000000],
    [17054321,  1.5,  10000000],
    [17054321,  1,    10000000],
    [17054321,  0.5,  10000000],
    [17054321,  0,    20000000],
    [17054321, -0.5,  15000000],
    [17054321, -1,    17000000],
    [17054321, -1.5,  17000000],
    [17054321, -2,    17100000]
];

for (const [v, off, expected] of gridCases) {
    test(`grid ${v}, offset=${off}`, ROUND_DYNAMIC(v, off), expected);
}

// Monotonicity property: for sorted input, output is non-decreasing.
// (This is the fundamental property the originating bug violated.)
function assertMonotonic(label, values, offset) {
    const sorted = [...values].sort((a, b) => a - b);
    const rounded = sorted.map(v => ROUND_DYNAMIC(v, offset));
    let ok = true;
    for (let i = 1; i < rounded.length; i++) {
        if (rounded[i] < rounded[i - 1]) {
            ok = false;
            break;
        }
    }
    test(`monotonic ${label} offset=${offset}`, ok, true);
}

// Originating-bug inputs from sprint plan.
const originatingValues = [73, 4591, 63538, 162583, 400000];
assertMonotonic('originating', originatingValues, 1);
assertMonotonic('originating', originatingValues, 0.5);
assertMonotonic('originating', originatingValues, -0.5);
assertMonotonic('originating', originatingValues, -1);
assertMonotonic('originating', originatingValues, 1.5);

// Sanity: a wider mixed range stays monotonic across positive half-steps.
const wideRange = [73, 4591, 17054, 63538, 162583, 400000, 1750000, 17054321, 47054321, 87054321];
assertMonotonic('wide range', wideRange, 1);
assertMonotonic('wide range', wideRange, 1.5);
assertMonotonic('wide range', wideRange, 0.5);

// Negative-value mirror.
test('negative grid -87054321, offset=0.5', ROUND_DYNAMIC(-87054321, 0.5), -100000000);
test('negative grid -47054321, offset=-1.5', ROUND_DYNAMIC(-47054321, -1.5), -47000000);

// =============================================================================
// THRESHOLD-FLIP (X_FLOOR_THRESHOLD = 0)
// =============================================================================

console.log('=== X_FLOOR_THRESHOLD flip ===\n');

// Re-eval round_dynamic.js with X_FLOOR_THRESHOLD set to 0 in a fresh sandbox so
// the x-floor triggers for |trunc(offset)| >= 0 (i.e. always, including +/-0.5).
(function () {
    const patched = code.replace(
        /const X_FLOOR_THRESHOLD\s*=\s*\d+;/,
        'const X_FLOOR_THRESHOLD = 0;'
    );
    // Sanity: patch actually applied.
    if (!/X_FLOOR_THRESHOLD\s*=\s*0/.test(patched)) {
        failed++;
        failures.push({ name: 'threshold patch applied', actual: 'no replacement', expected: 'patched source' });
        return;
    }
    // Isolate via a Function so the new const doesn't collide with the outer scope.
    const sandbox = new Function(patched + '; return { ROUND_DYNAMIC: ROUND_DYNAMIC, roundWithOffset: roundWithOffset };')();
    const RD = sandbox.ROUND_DYNAMIC;

    // With threshold=0, rd(17054321, 0.5) should pick up the x-floor at rd(v, 0) = 20M.
    test('threshold=0: rd(17054321, 0.5) → 20M', RD(17054321, 0.5), 20000000);
    // And rd(47054321, 0.5) should still be 50M (x-floor at rd(v,0)=50M matches raw).
    test('threshold=0: rd(47054321, 0.5) → 50M', RD(47054321, 0.5), 50000000);
    // -0.5 with threshold=0 now floors at rd(v, 0): rd(87054321, -0.5) raw=85M, x-floor=90M.
    test('threshold=0: rd(87054321, -0.5) → 90M', RD(87054321, -0.5), 90000000);
    // Sanity: default-threshold (1) behavior of rd(17054321, 0.5) is 10M (no x-floor).
    test('threshold=1 (default): rd(17054321, 0.5) → 10M', ROUND_DYNAMIC(17054321, 0.5), 10000000);
})();

// =============================================================================
// RESULTS
// =============================================================================

console.log('\n=== Results ===\n');
console.log(`✓ ${passed} passed`);
console.log(`✗ ${failed} failed`);

if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => {
        console.log(`  - ${f.name}: got ${JSON.stringify(f.actual)}, expected ${JSON.stringify(f.expected)}`);
    });
    process.exit(1);
}