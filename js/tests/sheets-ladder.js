/**
 * Sheets suite piece: the Sheets input step, the classification ladder, and
 * the result kind in ROUND_DYNAMIC.
 *
 * js/tests.js loads this piece and passes its harness. Every case runs the
 * built file under both values of the result kind: the piece reads the
 * built file's text, writes the RESULT_KIND line with each value in memory,
 * and runs each copy in its own context. The committed sources never change.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RESULT_KINDS = ['text', 'number'];

module.exports = function runSheetsLadder(h) {
    const { testExact, testArrayExact } = h;

    // One copy of the built file per result kind. A built file with no
    // RESULT_KIND line, or a copy that holds another value after the write,
    // fails the run: a copy that kept the committed value would test one
    // value twice.
    function loadResultKind(kind) {
        if (!h.RESULT_KIND_LINE.test(h.code)) {
            throw new Error('round_dynamic.js holds no RESULT_KIND line this piece writes');
        }
        const source = h.code.replace(h.RESULT_KIND_LINE, `const RESULT_KIND = '${kind}';`)
            + '\nthis.__sheetsLadderProbe = { RESULT_KIND, CURRENCIES };\n';
        const context = vm.createContext({});
        vm.runInContext(source, context, { filename: `round_dynamic.js (RESULT_KIND '${kind}')` });
        const probe = context.__sheetsLadderProbe;
        if (probe.RESULT_KIND !== kind) {
            throw new Error(`the RESULT_KIND '${kind}' copy holds '${probe.RESULT_KIND}'`);
        }
        return { ROUND_DYNAMIC: context.ROUND_DYNAMIC, CURRENCIES: probe.CURRENCIES };
    }
    const kinds = Object.fromEntries(RESULT_KINDS.map((kind) => [kind, loadResultKind(kind)]));

    // Runs one single-mode case and its one-cell dataset twin under one
    // result kind. A one-cell range at the same offsets returns the same
    // result as the single value.
    function bothModes(kind, label, input, expected) {
        const RD = kinds[kind].ROUND_DYNAMIC;
        testExact(`[${kind}] single mode: ${label}`, RD(input), expected);
        testArrayExact(`[${kind}] dataset mode: ${label}`, RD([[input]]), [[expected]]);
    }
    // The same expectation under both result kinds.
    function everyKind(label, input, expected) {
        for (const kind of RESULT_KINDS) bothModes(kind, label, input, expected);
    }
    function typeOf(kind, label, value, expectedType) {
        testExact(`[${kind}] ${label}: type`, typeof value, expectedType);
    }

    // --- Criterion 1 and 2: text cells under each result kind -------------
    // A pure cell and a bracketed number return text under 'text' and the
    // rounded value under 'number'. A cell with words or a unit number
    // returns text under both values.
    bothModes('text', 'a pure cell "$1,011" returns text', '$1,011', '$1,000');
    bothModes('number', 'a pure cell "$1,011" returns the rounded value', '$1,011', 1000);
    bothModes('text', 'a bracketed number "(1,234)" returns text', '(1,234)', '(1,000)');
    bothModes('number', 'a bracketed number "(1,234)" returns the rounded value', '(1,234)', -1000);
    bothModes('text', 'a pure cell "12.5%" returns text', '12.5%', '15%');
    bothModes('number', 'a pure cell "12.5%" returns the rounded value', '12.5%', 15);
    bothModes('text', 'a bracketed number "($1,234)" returns text', '($1,234)', '($1,000)');
    bothModes('number', 'a bracketed number "($1,234)" returns the rounded value', '($1,234)', -1000);
    everyKind('numbers inside text "about 1,234 users" round in place', 'about 1,234 users', 'about 1,000 users');
    everyKind('a unit number "4.91tn" rounds its digits', '4.91tn', '5tn');
    everyKind('a unit number "1,234 USD" rounds its digits', '1,234 USD', '1,000 USD');
    everyKind('an extracted cell with two numbers rounds each at its own magnitude',
        'rev 1,600 and 98,765', 'rev 1,500 and 100,000');
    for (const kind of RESULT_KINDS) {
        const RD = kinds[kind].ROUND_DYNAMIC;
        typeOf(kind, 'numbers inside text return text', RD('about 1,234 users'), 'string');
        typeOf(kind, 'a unit number returns text', RD('4.91tn'), 'string');
    }
    typeOf('text', 'a pure cell returns text', kinds.text.ROUND_DYNAMIC('$1,011'), 'string');
    typeOf('number', 'a pure cell returns a number', kinds.number.ROUND_DYNAMIC('$1,011'), 'number');
    typeOf('number', 'a bracketed number returns a number', kinds.number.ROUND_DYNAMIC('(1,234)'), 'number');

    // "4.91tn" rounds as the extension rounds it: the extension's suite
    // rounds the row ["4.91tn", "CAD45.67m", "DT1234"] on an HTML table with
    // the first row and column rounded and the default offsets, and expects
    // ["5tn", "CAD45m", "DT1234"].
    for (const kind of RESULT_KINDS) {
        testArrayExact(`[${kind}] dataset mode: unit numbers round as the extension rounds the same row`,
            kinds[kind].ROUND_DYNAMIC([['4.91tn', 'CAD45.67m', 'DT1234']]), [['5tn', 'CAD45m', 'DT1234']]);
    }

    // A range that mixes the cell kinds: each cell follows its own rule.
    testArrayExact('[text] dataset mode: a pure cell, words, and a bracketed number in one range',
        kinds.text.ROUND_DYNAMIC([['$1,011', 'about 1,234 users', '(1,234)']]),
        [['$1,000', 'about 1,000 users', '(1,000)']]);
    testArrayExact('[number] dataset mode: a pure cell, words, and a bracketed number in one range',
        kinds.number.ROUND_DYNAMIC([['$1,011', 'about 1,234 users', '(1,234)']]),
        [[1000, 'about 1,000 users', -1000]]);

    // --- Criterion 3: values that are not text -----------------------------
    // A plain number rounds as today and returns a number. A date object, a
    // boolean, and an empty cell return unchanged.
    const date = new Date(2020, 0, 15);
    for (const kind of RESULT_KINDS) {
        const RD = kinds[kind].ROUND_DYNAMIC;
        bothModes(kind, 'a plain number rounds as today', 4308910, 4500000);
        bothModes(kind, 'a plain negative number rounds as today', -42.66, -45);
        bothModes(kind, 'a plain number 2020 rounds as a number', 2020, 2000);
        bothModes(kind, 'zero returns zero', 0, 0);
        typeOf(kind, 'single mode: a plain number returns a number', RD(1234), 'number');
        typeOf(kind, 'dataset mode: a plain number beside text returns a number',
            RD([[1234, '$5,678']])[0][0], 'number');
        bothModes(kind, 'a date object returns the same object', date, date);
        bothModes(kind, 'the boolean true returns unchanged', true, true);
        bothModes(kind, 'the boolean false returns unchanged', false, false);
        bothModes(kind, 'an empty cell returns an empty cell', '', '');
        testArrayExact(`[${kind}] dataset mode: a number, a date, booleans, and empty cells in one range`,
            RD([[1234, date, true, false, '']]), [[1000, date, true, false, '']]);
    }

    // --- Criterion 4: text that stays as written ---------------------------
    // Identifier shapes stay. Dates and times are off, so date and time text
    // stays. A year inside text rounds; a bare year typed as text stays.
    const unchanged = [
        ['a phone number', '416-555-1234'],
        ['a phone number with a bracketed area code', '(416) 555-1234'],
        ['digit groups split by spaces', '416 555 1234'],
        ['an IP address', '192.168.0.1'],
        ['a postal code', 'M5V 2T6'],
        ['a postal code with a suffix', '90210-1234'],
        ['an email address', 'name@example.com'],
        ['a web address', 'https://example.com/page/123'],
        ['an ISBN', 'ISBN 978-0-306-40615-7'],
        ['date text', '2024-01-15'],
        ['date text with a month name', 'June 21, 2020'],
        ['a month and year', 'Jan 2020'],
        ['time text', '9:30'],
        ['time text with a meridiem', '10:30 AM'],
        ['time text with seconds', '14:05:30'],
        ['a date and time', '2024-06-15T10:30:00'],
        ['a bare year typed as text', '2020'],
    ];
    for (const [label, input] of unchanged) everyKind(`${label} "${input}" stays`, input, input);
    everyKind('a year inside text "Q3 2020" rounds', 'Q3 2020', 'Q3 2,000');
    everyKind('inside text, a phone number keeps its digits and the other number rounds',
        'Call 416-555-1234 about 1,613,245 units', 'Call 416-555-1234 about 1,500,000 units');
    for (const kind of RESULT_KINDS) {
        testArrayExact(`[${kind}] dataset mode: identifier shapes and date and time text in one range stay`,
            kinds[kind].ROUND_DYNAMIC([['416-555-1234', '2024-01-15', '9:30', '2020', 'Q3 2020']]),
            [['416-555-1234', '2024-01-15', '9:30', '2020', 'Q3 2,000']]);
    }

    // --- Criterion 5: the dataset and the max magnitude --------------------
    // Offsets -0.5 for the top band and 0 for the rest, so a number's band
    // shows in its result: 1,600 rounds to 1,500 in the top band and to
    // 2,000 outside it.
    for (const kind of RESULT_KINDS) {
        const RD = kinds[kind].ROUND_DYNAMIC;
        testArrayExact(`[${kind}] max magnitude: a larger number inside text puts a plain number outside the top band`,
            RD([[1600, 'about 98,765 users']], -0.5, 0, 1), [[2000, 'about 100,000 users']]);
        testArrayExact(`[${kind}] max magnitude: a larger plain number puts a number inside text outside the top band`,
            RD([[98765, 'about 1,600 users']], -0.5, 0, 1), [[100000, 'about 2,000 users']]);
        testArrayExact(`[${kind}] max magnitude: two numbers in one text cell take their own bands`,
            RD([['rev 1,600 and 98,765']], -0.5, 0, 1), [['rev 2,000 and 100,000']]);
        testArrayExact(`[${kind}] max magnitude: a larger unit number puts a plain number outside the top band`,
            RD([[1600, '98,765 USD']], -0.5, 0, 1), [[2000, '100,000 USD']]);
        testArrayExact(`[${kind}] max magnitude: identifier shapes and date text add no number`,
            RD([[160, '416-555-1234', '2024-01-15', '2020', '9:30', '192.168.0.1']], -0.5, 0, 1),
            [[150, '416-555-1234', '2024-01-15', '2020', '9:30', '192.168.0.1']]);
        testArrayExact(`[${kind}] max magnitude: an empty cell, a boolean, and a date add no number`,
            RD([[160, '', true, date]], -0.5, 0, 1), [[150, '', true, date]]);
    }
    testArrayExact('[text] max magnitude: a larger pure cell puts a plain number outside the top band',
        kinds.text.ROUND_DYNAMIC([[1600, '$98,765']], -0.5, 0, 1), [[2000, '$100,000']]);
    testArrayExact('[number] max magnitude: a larger pure cell puts a plain number outside the top band',
        kinds.number.ROUND_DYNAMIC([[1600, '$98,765']], -0.5, 0, 1), [[2000, 100000]]);
    testArrayExact('[text] max magnitude: a larger bracketed number puts a plain number outside the top band',
        kinds.text.ROUND_DYNAMIC([[1600, '(98,765)']], -0.5, 0, 1), [[2000, '(100,000)']]);
    testArrayExact('[number] max magnitude: a larger bracketed number puts a plain number outside the top band',
        kinds.number.ROUND_DYNAMIC([[1600, '(98,765)']], -0.5, 0, 1), [[2000, -100000]]);

    // The first row and the first column round: every cell of this range is
    // text in the first row or the first column except 9,876.
    const firstRowAndColumn = [['$1,234', 'about 5,678 users'], ['4,321 units', 9876]];
    testArrayExact('[text] dataset mode: the first row and the first column round',
        kinds.text.ROUND_DYNAMIC(firstRowAndColumn), [['$1,000', 'about 5,500 users'], ['4,500 units', 10000]]);
    testArrayExact('[number] dataset mode: the first row and the first column round',
        kinds.number.ROUND_DYNAMIC(firstRowAndColumn), [[1000, 'about 5,500 users'], ['4,500 units', 10000]]);

    // --- Criterion 6: the currency list ------------------------------------
    // "R47" is a pure cell with a currency sign written in letters; "CAD45.67"
    // is a unit number, so it returns text under both values.
    bothModes('text', 'a currency sign written in letters "R47" rounds', 'R47', 'R45');
    bothModes('number', 'a currency sign written in letters "R47" rounds', 'R47', 45);
    everyKind('a currency code "CAD45.67" makes a unit number that rounds', 'CAD45.67', 'CAD45');
    everyKind('a sign written in letters counts only as its own token', 'Revenue 47', 'Revenue 45');

    // Every sign and every code in the currency list the built file holds
    // rounds. The list comes from the built file, not from a copy here.
    for (const kind of RESULT_KINDS) {
        const { ROUND_DYNAMIC: RD, CURRENCIES } = kinds[kind];
        if (!Array.isArray(CURRENCIES) || CURRENCIES.length === 0) {
            h.fail(`[${kind}] the currency list`, 'no CURRENCIES list in the built file', 'a currency list');
            continue;
        }
        for (const currency of CURRENCIES) {
            for (const sign of currency.signs) {
                testExact(`[${kind}] currency list: ${currency.name} sign "${sign}47" rounds`,
                    RD(sign + '47'), kind === 'text' ? sign + '45' : 45);
            }
            // A code beside a number makes a unit number, which returns text
            // under both values; a code that is also one of its currency's
            // signs ("XCG") makes a pure cell.
            const isPureCell = currency.signs.includes(currency.code);
            testExact(`[${kind}] currency list: ${currency.name} code "${currency.code}47" rounds`,
                RD(currency.code + '47'), kind === 'number' && isPureCell ? 45 : currency.code + '45');
        }
    }

    // The README's currency-sign line states the full currency list: it
    // points at the one list, and that list is the one the built file holds.
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const currencyLine = readme.split('\n').find((line) => line.startsWith('**Currency signs:**'));
    if (!currencyLine) {
        h.fail('README currency-sign line', 'no line that starts with **Currency signs:**', 'the currency-sign line');
    } else {
        const listName = (currencyLine.match(/`(\w+)` in \[`([^`]+)`\]\(([^)]+)\)/) || []);
        const [, name, , link] = listName;
        testExact('README currency-sign line: names the currency list CURRENCIES', name, 'CURRENCIES');
        const linked = link ? path.join(__dirname, '..', link) : null;
        testExact('README currency-sign line: links the file that declares the list',
            linked !== null && fs.existsSync(linked) && /^const CURRENCIES = \[/m.test(fs.readFileSync(linked, 'utf8')), true);
        testExact('README currency-sign line: the linked file is the one the Sheets build joins',
            linked !== null && h.code.includes('// ---- ' + path.relative(path.join(__dirname, '..', '..'), linked) + ' ----'), true);
        testExact('README currency-sign line: lists no subset of the signs', /\$, €, £/.test(currencyLine), false);
    }

    // --- Criterion 7: the field the Sheets suite reads ---------------------
    // The suite reads the field that matches the constant in the Sheets
    // entry source, and the built file holds the same constant.
    const entry = fs.readFileSync(path.join(__dirname, '..', 'src', 'entry.js'), 'utf8');
    const entryKind = (entry.match(h.RESULT_KIND_LINE) || [])[1];
    const builtKind = (h.code.match(h.RESULT_KIND_LINE) || [])[1];
    testExact('result kind: the Sheets entry source holds a RESULT_KIND line', RESULT_KINDS.includes(entryKind), true);
    testExact('result kind: the built file holds the entry source\'s value', builtKind, entryKind);
    testExact('result kind: the suite reads the field that matches the value', h.resultKindField, h.RESULT_KIND_FIELD[entryKind]);
    for (const kind of RESULT_KINDS) {
        testExact(`result kind: the suite holds a field for the value '${kind}'`, typeof h.RESULT_KIND_FIELD[kind], 'string');
    }

    // The whole shared case table under each value of the result kind, read
    // the way the suite reads it: `expected` for a row of numbers, and the
    // value's field for a row that holds text. A flip of the constant needs
    // no change to the case table, so every row holds a correct expectation
    // under both values.
    for (const kind of RESULT_KINDS) {
        const RD = kinds[kind].ROUND_DYNAMIC;
        const field = h.RESULT_KIND_FIELD[kind];
        for (const group of h.sharedCaseGroups) {
            for (const c of group.cases) {
                const name = `[${kind}, shared] ${group.description}: ${JSON.stringify(c.input)}`;
                const rowField = h.holdsText(c.input) ? field : 'expected';
                if (!(rowField in c)) {
                    h.fail(name, `no ${rowField} field`, `a ${rowField} field`);
                    continue;
                }
                const { input, params } = c;
                if (Array.isArray(input)) {
                    testArrayExact(name, RD(input, params.offset_top, params.offset_other, params.num_top), c[rowField]);
                } else {
                    testExact(name, RD(input, params.offset_top), c[rowField]);
                }
            }
        }
    }
};
