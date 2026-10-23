| \="Summary: " & COUNTIF(A2:A, "✓") & " passed, " & COUNTIF(A2:A, "✗") & " failed" |  |  |  |  |  |  |  |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |  |  |
| Section 1: Single Mode |  |  |  |  |  |  |  |
|  | **Single Mode** |  |  | *//format as number with no decimals* | *//format as number with no decimals* |  |  |
|  | **Input** | **Offset** | **Formula** | **Result** | **Expected** |  |  |
| \=IF(E6=F6, "✓", "✗") | 87654321 | (default) | `=FORMULATEXT(E6)` | `=ROUND_DYNAMIC(B6)` | 90,000,000 |  |  |
| \=IF(E7=F7, "✓", "✗") | 86543210 | (default) | `=FORMULATEXT(E7)` | `=ROUND_DYNAMIC(B7)` | 85,000,000 |  |  |
| \=IF(E8=F8, "✓", "✗") | 87654321 | 0 | `=FORMULATEXT(E8)` | `=ROUND_DYNAMIC(B8, C8)` | 90,000,000 |  |  |
| \=IF(E9=F9, "✓", "✗") | 87654321 | \-1 | `=FORMULATEXT(E9)` | `=ROUND_DYNAMIC(B9, C9)` | 88,000,000 |  |  |
| \=IF(E10=F10, "✓", "✗") | 87654321 | \-1.5 | `=FORMULATEXT(E10)` | `=ROUND_DYNAMIC(B10, C10)` | 88,000,000 |  |  |
| \=IF(E11=F11, "✓", "✗") | 87654321 | 1 | `=FORMULATEXT(E11)` | `=ROUND_DYNAMIC(B11, C11)` | 100,000,000 |  |  |
| \=IF(E12=F12, "✓", "✗") | \-4321 | (default) | `=FORMULATEXT(E12)` | `=ROUND_DYNAMIC(B12)` | \-4,500 |  |  |
| \=IF(E13=F13, "✓", "✗") | 0.033 | (default) | `=FORMULATEXT(E13)` | `=ROUND_DYNAMIC(B13)` | 0.035 |  |  |
| \=IF(E14=F14, "✓", "✗") | 0 | (default) | `=FORMULATEXT(E14)` | `=ROUND_DYNAMIC(B14)` | 0 |  |  |
| \=IF(E15="", "✓", "✗") |  | \-1 | `=FORMULATEXT(E15)` | `=ROUND_DYNAMIC(B15, -1)` | (empty) |  |  |
| \=IF(E16=F16, "✓", "✗") | hello | (default) | `=FORMULATEXT(E16)` | `=ROUND_DYNAMIC(B16)` | hello |  |  |
|  |  |  |  |  |  |  |  |
| Section 2: Dataset Mode |  |  |  |  |  |  |  |
|  | **Dataset Mode** |  | *//format as number with no decimals* | *//format as number with no decimals* |  |  |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  |  |  |
| \=IF(D21=E21, "✓", "✗") | 4428910 | `=FORMULATEXT(D21)` | `=ROUND_DYNAMIC($B$21:$B$24)` | 4,500,000 |  |  |  |
| \=IF(D22=E22, "✓", "✗") | 983321 | *(spills)* | 1,000,000 | 1,000,000 |  |  |  |
| \=IF(D23=E23, "✓", "✗") | 42109 | *(spills)* | 40,000 | 40,000 |  |  |  |
| \=IF(D24=E24, "✓", "✗") | 1234 | *(spills)* | 1,000 | 1,000 |  |  |  |
|  |  |  |  |  |  |  |  |
|  | **With custom params** | offset\_top | offset\_other | num\_top |  |  |  |
|  |  | \-1 | 0 | 1 |  |  |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  |  |  |
| \=IF(D29=E29, "✓", "✗") | 4428910 | `=FORMULATEXT(D29)` | `=ROUND_DYNAMIC($B$29:$B$32, C27, D27, E27)` | 4,400,000 |  |  |  |
| \=IF(D30=E30, "✓", "✗") | 983321 | *(spills)* | 1,000,000 | 1,000,000 |  |  |  |
| \=IF(D31=E31, "✓", "✗") | 44109 | *(spills)* | 40,000 | 40,000 |  |  |  |
| \=IF(D32=E32, "✓", "✗") | 1234 | *(spills)* | 1,000 | 1,000 |  |  |  |
|  |  |  |  |  |  |  |  |
| Section 3: Input Handling |  |  |  |  |  |  |  |
|  | **Input Handling** |  |  |  |  | *//format B38, B40:B42, E38, and E40:E42 as plain text* |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  | **Note:** |  |
| \=IF(D37=E37, "✓", "✗") | \-500 | `=FORMULATEXT(D37)` | `=ROUND_DYNAMIC(B37)` | \-500 |  | Note: a number in accounting format; the cell shows $ (500.00) |  |
| \=IF(D38=E38, "✓", "✗") | (500) | `=FORMULATEXT(D38)` | `=ROUND_DYNAMIC(B38)` | (500) |  | Note: text in accounting form; the brackets stay |  |
| \=IF(D39=E39, "✓", "✗") | \-500 | `=FORMULATEXT(D39)` | `=ROUND_DYNAMIC(B39)` | \-500 |  | Note: a number in currency format; the cell shows -$500.00 |  |
| \=IF(D40=E40, "✓", "✗") | $1,234.56 | `=FORMULATEXT(D40)` | `=ROUND_DYNAMIC(B40)` | $1,000 |  | \="ISTEXT(B40)= " & ISTEXT(B40) |  |
| \=IF(D41=E41, "✓", "✗") | €4,500 | `=FORMULATEXT(D41)` | `=ROUND_DYNAMIC(B41)` | €4,500 |  | \="ISTEXT(B41)= " & ISTEXT(B41) |  |
| \=IF(D42=E42, "✓", "✗") | 1,234,567 | `=FORMULATEXT(D42)` | `=ROUND_DYNAMIC(B42)` | 1,000,000 |  | \="ISTEXT(B42)= " & ISTEXT(B42) |  |
| \=IF(D43=E43, "✓", "✗") | TRUE | `=FORMULATEXT(D43)` | `=ROUND_DYNAMIC(B43)` | TRUE |  | \="ISLOGICAL(B43)=" & ISLOGICAL(B43) |  |
| \=IF(ISREF(D44), "✓", "✗") | \#REF\! | `=FORMULATEXT(D44)` | `=ROUND_DYNAMIC(B44)` | \#REF\! |  | \="ISREF(B44)= " & ISREF(B44) |  |
|  |  |  |  |  |  |  |  |
| Section 4: Validation |  |  |  |  |  |  |  |
|  | **Validation** |  |  |  |  |  |  |
|  | **Input** | **OFFSET** | **Formula** | **Result** | **Expected** | **Note:** |  |
| \=IF(ISERR(E49), "✓", "✗") | 1000 | 21 | `=FORMULATEXT(E49)` | `=ROUND_DYNAMIC(B49, C49)` | \#ERROR\! | Notice the cell's error message. |  |
| \=IF(ISERR(E50), "✓", "✗") | 1000 | \-21 | `=FORMULATEXT(E50)` | `=ROUND_DYNAMIC(B50, C50)` | \#ERROR\! |  |  |
| \=IF(E51=F51, "✓", "✗") | 9393 | 20 | `=FORMULATEXT(E51)` | `=ROUND_DYNAMIC(B51, C51)` | 1000 | Note: the value-OoM floor stops the collapse to 0 |  |
| \=IF(E52=F52, "✓", "✗") | 9393 | \-20 | `=FORMULATEXT(E52)` | `=ROUND_DYNAMIC(B52, C52)` | 9393 |  |  |
|  |  |  |  |  |  |  |  |
| Section 5: Parsing edge cases |  |  |  |  |  |  |  |
|  | **Parsing edge cases** |  |  |  |  | *//format the Input and Expected cells as plain text* |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  | **Note:** |  |
| \=IF(D57=E57, "✓", "✗") | 50% | `=FORMULATEXT(D57)` | `=ROUND_DYNAMIC(B57)` | 50% |  | Note: the percent sign stays, and the number is not scaled |  |
| \=IF(D58=E58, "✓", "✗") | −502 | `=FORMULATEXT(D58)` | `=ROUND_DYNAMIC(B58)` | −500 |  | Note: the "long minus" sign (U+2212) reads as a minus sign and stays |  |
| \=IF(D59=E59, "✓", "✗") | $ | `=FORMULATEXT(D59)` | `=ROUND_DYNAMIC(B59)` | $ |  | Note: symbol-only string passes through, not 0 |  |
|  |  |  |  |  |  |  |  |
| Section 6: Text cells |  |  |  |  |  |  |  |
|  | **Text cells** |  |  |  |  | *//format the Input and Expected cells as plain text* |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  | **Note:** |  |
| \=IF(D64=E64, "✓", "✗") | about 1,234 users | `=FORMULATEXT(D64)` | `=ROUND_DYNAMIC(B64)` | about 1,000 users |  | Note: a number inside text rounds in place |  |
| \=IF(D65=E65, "✓", "✗") | 4.91tn | `=FORMULATEXT(D65)` | `=ROUND_DYNAMIC(B65)` | 5tn |  | Note: a unit number keeps its magnitude suffix |  |
| \=IF(D66=E66, "✓", "✗") | CAD45.67 | `=FORMULATEXT(D66)` | `=ROUND_DYNAMIC(B66)` | CAD45 |  | Note: a unit number keeps its currency code |  |
| \=IF(D67=E67, "✓", "✗") | R47 | `=FORMULATEXT(D67)` | `=ROUND_DYNAMIC(B67)` | R45 |  | Note: a currency sign written in letters |  |
| \=IF(D68=E68, "✓", "✗") | (1,234) | `=FORMULATEXT(D68)` | `=ROUND_DYNAMIC(B68)` | (1,000) |  | Note: a bracketed number keeps its brackets |  |
| \=IF(D69=E69, "✓", "✗") | $1,011 | `=FORMULATEXT(D69)` | `=ROUND_DYNAMIC(B69)` | $1,000 |  | \="ISTEXT(D69)= " & ISTEXT(D69) |  |
| \=IF(D70=E70, "✓", "✗") | 416-555-1234 | `=FORMULATEXT(D70)` | `=ROUND_DYNAMIC(B70)` | 416-555-1234 |  | Note: a phone number stays |  |
| \=IF(D71=E71, "✓", "✗") | Q3 2020 | `=FORMULATEXT(D71)` | `=ROUND_DYNAMIC(B71)` | Q3 2,000 |  | Note: a year inside text rounds |  |
| \=IF(D72=E72, "✓", "✗") | 2020 | `=FORMULATEXT(D72)` | `=ROUND_DYNAMIC(B72)` | 2020 |  | Note: a bare year typed as text reads as a date, and dates stay |  |
| \=IF(D73=E73, "✓", "✗") | 2024-01-15 | `=FORMULATEXT(D73)` | `=ROUND_DYNAMIC(B73)` | 2024-01-15 |  | Note: date text stays |  |
