
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
| \=IF(E10=F10, "✓", "✗") | 87654321 | \-1.5 | `=FORMULATEXT(E10)` | `=ROUND_DYNAMIC(B10, C10)` | 87,500,000 |  |  |
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
| \=IF(D22=E22, "✓", "✗") | 983321 | *(spills)* | `1,000,000` | 1,000,000 |  |  |  |
| \=IF(D23=E23, "✓", "✗") | 42109 | *(spills)* | `40,000` | 40,000 |  |  |  |
| \=IF(D24=E24, "✓", "✗") | 1234 | *(spills)* | `1,000` | 1,000 |  |  |  |
|  |  |  |  |  |  |  |  |
|  | **With custom params** |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  | **Input** | **Formula** | **Result** | **Expected** | offset\_top | offset\_other | num\_top |
| \=IF(D29=E29, "✓", "✗") | 4428910 | `=FORMULATEXT(D29)` | `=ROUND_DYNAMIC($B$29:$B$32, F29, G29, H29)` | 4,400,000 | \-1 | 0 | 1 |
| \=IF(D30=E30, "✓", "✗") | 983321 | *(spills)* | `1,000,000` | 1,000,000 |  |  |  |
| \=IF(D31=E31, "✓", "✗") | 44109 | *(spills)* | `40,000` | 40,000 |  |  |  |
| \=IF(D32=E32, "✓", "✗") | 1234 | *(spills)* | `1,000` | 1,000 |  |  |  |
|  |  |  |  |  |  |  |  |
| Section 3: Dataset-Aware Single Mode |  |  |  |  |  |  |  |
|  | **Dataset-Aware Single** |  |  |  |  |  |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  |  |  |
| \=IF(D37=E37, "✓", "✗") | 4428910 | `=FORMULATEXT(D37)` | `=ROUND_DYNAMIC(B37, $B$37:$B$40)` | 4,500,000 |  |  |  |
| \=IF(D38=E38, "✓", "✗") | 983321 | `=FORMULATEXT(D38)` | `=ROUND_DYNAMIC(B38, $B$37:$B$40)` | 1,000,000 |  |  |  |
| \=IF(D39=E39, "✓", "✗") | 42109 | `=FORMULATEXT(D39)` | `=ROUND_DYNAMIC(B39, $B$37:$B$40)` | 40,000 |  |  |  |
| \=IF(D40=E40, "✓", "✗") | 1234 | `=FORMULATEXT(D40)` | `=ROUND_DYNAMIC(B40, $B$37:$B$40)` | 1,000 |  |  |  |
|  |  |  |  |  |  |  |  |
| Section 4: Input Handling |  |  |  |  |  |  |  |
|  | **Input Handling** |  |  |  |  |  |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  | **Note:** |  |
| \=IF(D45=E45, "✓", "✗") | $ (500.00) | `=FORMULATEXT(D45)` | `=ROUND_DYNAMIC(B45)` | \-500 |  | Note: accounting format |  |
| \=IF(D46=E46, "✓", "✗") | (500) | `=FORMULATEXT(D46)` | `=ROUND_DYNAMIC(B46)` | \-500 |  | Note: string representation of accounting format |  |
| \=IF(D47=E47, "✓", "✗") | \-$500.00 | `=FORMULATEXT(D47)` | `=ROUND_DYNAMIC(B47)` | \-500 |  | Note: currency format |  |
| \=IF(D48=E48, "✓", "✗") | $1,234.56 | `=FORMULATEXT(D48)` | `=ROUND_DYNAMIC(B48)` | 1000 |  | \="ISTEXT(..)= " & ISTEXT(B48) |  |
| \=IF(D49=E49, "✓", "✗") | €4,500 | `=FORMULATEXT(D49)` | `=ROUND_DYNAMIC(B49)` | 4500 |  | \="ISTEXT(..)= " & ISTEXT(B49) |  |
| \=IF(D50=E50, "✓", "✗") | 1,234,567 | `=FORMULATEXT(D50)` | `=ROUND_DYNAMIC(B50)` | 1000000 |  | \="ISTEXT(..)= " & ISTEXT(B50) |  |
| \=IF(D51=E51, "✓", "✗") | TRUE | `=FORMULATEXT(D51)` | `=ROUND_DYNAMIC(B51)` | TRUE |  | \="ISLOGICAL(..)=" & ISLOGICAL(B51) |  |
| \=IF(ISREF(D52), "✓", "✗") | \#REF\! | `=FORMULATEXT(D52)` | `=ROUND_DYNAMIC(B52)` | \#REF\! |  | \="ISREF(..)= " & ISREF(B52) |  |
|  |  |  |  |  |  |  |  |
| Section 5: Validation |  |  |  |  |  |  |  |
|  | **Validation** |  |  |  |  |  |  |
|  | **Input** | **OFFSET** | **Formula** | **Result** | **Expected** |  |  |
| \=IF(ISERR(E57), "✓", "✗") | 1000 | 21 | `=FORMULATEXT(E57)` | `=ROUND_DYNAMIC(B57, C57)` | \#ERROR\! |  |  |
| \=IF(ISERR(E58), "✓", "✗") | 1000 | \-21 | `=FORMULATEXT(E58)` | `=ROUND_DYNAMIC(B58, C58)` | \#ERROR\! |  |  |
| \=IF(E59=F59, "✓", "✗") | 9393 | 20 | `=FORMULATEXT(E59)` | `=ROUND_DYNAMIC(B59, C59)` | 0 |  |  |
| \=IF(E60=F60, "✓", "✗") | 9393 | \-20 | `=FORMULATEXT(E60)` | `=ROUND_DYNAMIC(B60, C60)` | `9393` |  |  |
|  |  |  |  |  |  |  |  |
