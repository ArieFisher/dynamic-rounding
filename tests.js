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
test('87654321, offset=0.5', ROUND_DYNAMIC(87654321, 0.5), 90000000);
test('87654321, offset=-0.5', ROUND_DYNAMIC(87654321, -0.5), 90000000);
test('87654321, offset=-1.5', ROUND_DYNAMIC(87654321, -1.5), 87500000);
test('87654321, offset=-2.5', ROUND_DYNAMIC(87654321, -2.5), 87650000);

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

// Defaults: offset_top=-0.5, offset_other=0, num_top=1
// Mag 6 gets offset=-0.5, others get offset=0
testArray('GCP defaults', ROUND_DYNAMIC(gcpData), [
    [4500000],   // mag 6, offset=-0.5, base=500k
    [4000000],   // mag 6, offset=-0.5
    [1000000],   // mag 6, offset=-0.5
    [1000000],   // mag 5, offset=0, base=100k
    [800000],    // mag 5, offset=0
    [80000],     // mag 4, offset=0
    [40000],     // mag 4, offset=0
    [20000],     // mag 4, offset=0
    [2000],      // mag 3, offset=0
    [1000],      // mag 3, offset=0
    [70],        // mag 1, offset=0
    [40]         // mag 1, offset=0
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

// Defaults: offset_top=-0.5, offset_other=0, num_top=1
// Mag -1 gets offset=-0.5, others get offset=0
testArray('Decimals defaults', ROUND_DYNAMIC(decimalsData), [
    [0.35],      // mag -1, offset=-0.5, base=0.05
    [0.10],      // mag -1, offset=-0.5
    [0.05],      // mag -2, offset=0, base=0.01
    [0.008]      // mag -3, offset=0, base=0.001
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
    [40]
]);

// =============================================================================
// DATASET-AWARE SINGLE MODE TESTS
// =============================================================================

console.log('=== Dataset-Aware Single Mode ===\n');

// Same as dataset mode but per-value
test('Dataset-aware single: 4428910.41 in GCP', ROUND_DYNAMIC(4428910.41, gcpData), 4500000);
test('Dataset-aware single: 983321.11 in GCP', ROUND_DYNAMIC(983321.11, gcpData), 1000000);
test('Dataset-aware single: 42.66 in GCP', ROUND_DYNAMIC(42.66, gcpData), 40);

// With custom params
test('Dataset-aware single: 4428910.41 offset_top=-1', ROUND_DYNAMIC(4428910.41, gcpData, -1, 0, 1), 4400000);
test('Dataset-aware single: 983321.11 offset_other=-1', ROUND_DYNAMIC(983321.11, gcpData, -0.5, -1, 1), 980000);
test('Dataset-aware single: 983321.11 num_top=2', ROUND_DYNAMIC(983321.11, gcpData, -0.5, 0, 2), 1000000);

// Decimals
test('Dataset-aware single: 0.35 in decimals', ROUND_DYNAMIC(0.35, decimalsData), 0.35);
test('Dataset-aware single: 0.047 in decimals', ROUND_DYNAMIC(0.047, decimalsData), 0.05);

// Edge cases
test('Dataset-aware single: non-numeric', ROUND_DYNAMIC('Cloud CDN', gcpData), 'Cloud CDN');
test('Dataset-aware single: zero', ROUND_DYNAMIC(0, gcpData), 0);
test('Dataset-aware single: empty', ROUND_DYNAMIC('', gcpData), '');

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
test('Array: number rounds 3', mixedWithDatesResult[4][0], 40);

// Sort-safe mode with dates
test('Sort-safe: date passthrough', ROUND_DYNAMIC(date1, gcpData), date1);
test('Sort-safe: time passthrough', ROUND_DYNAMIC(time1, gcpData), time1);

// Date in reference range (should be ignored for max magnitude calc)
const rangeWithDate = [
    [4428910.41],
    [date1],
    [1000]
];
test('Sort-safe: date in ref range ignored', ROUND_DYNAMIC(4428910.41, rangeWithDate), 4500000);

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

// Offset boundary: 0.5 vs -0.5 equivalence
test('87654321 offset=0.5', ROUND_DYNAMIC(87654321, 0.5), ROUND_DYNAMIC(87654321, -0.5));
test('87654321 offset=0.3', ROUND_DYNAMIC(87654321, 0.3), ROUND_DYNAMIC(87654321, -0.3));

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

// offset >= 2 always returns 0 (short-circuit optimization)
test('offset=2 returns 0', ROUND_DYNAMIC(9999, 2), 0);
test('offset=2.5 returns 0', ROUND_DYNAMIC(9999, 2.5), 0);
test('offset=5 returns 0', ROUND_DYNAMIC(1e10, 5), 0);
test('offset=20 returns 0', ROUND_DYNAMIC(1e20, 20), 0);
test('offset=2 negative input returns 0', ROUND_DYNAMIC(-9999, 2), 0);

// Array mode validation
testThrows('array offset_top=25 throws', () => ROUND_DYNAMIC([[1000]], 25, 0, 1), 'offset_top must be between -20 and 20');
testThrows('array offset_other=25 throws', () => ROUND_DYNAMIC([[1000]], 0, 25, 1), 'offset_other must be between -20 and 20');

// Sort-safe mode validation
testThrows('sort-safe offset_top=25 throws', () => ROUND_DYNAMIC(1000, [[1000]], 25, 0, 1), 'offset_top must be between -20 and 20');
testThrows('sort-safe offset_other=25 throws', () => ROUND_DYNAMIC(1000, [[1000]], 0, 25, 1), 'offset_other must be between -20 and 20');

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
testArray('1D row vector', ROUND_DYNAMIC(rowVector), [4500000, 1000000, 40]);

// 2D single row
const singleRow = [[4428910.41, 983321.11, 42.66]];
testArray('2D single row', ROUND_DYNAMIC(singleRow), [[4500000, 1000000, 40]]);

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
    [40, 30]
]);

// Sort-safe with 1D reference range
test('Sort-safe: 1D ref range', ROUND_DYNAMIC(4428910.41, [4428910.41, 983321.11, 42.66]), 4500000);

// Sort-safe with single value as "range" - not valid usage, omitting test

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