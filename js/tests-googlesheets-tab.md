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
| \=IF(D37=E37, "✓", "✗") | \-511 | `=FORMULATEXT(D37)` | `=ROUND_DYNAMIC(B37)` | \-500 |  | Note: a number in accounting format; the cell shows $ (511.00) |  |
| \=IF(D38=E38, "✓", "✗") | (511) | `=FORMULATEXT(D38)` | `=ROUND_DYNAMIC(B38)` | (500) |  | Note: text in accounting form; the brackets stay |  |
| \=IF(D39=E39, "✓", "✗") | \-511 | `=FORMULATEXT(D39)` | `=ROUND_DYNAMIC(B39)` | \-500 |  | Note: a number in currency format; the cell shows -$511.00 |  |
| \=IF(D40=E40, "✓", "✗") | $1,234.56 | `=FORMULATEXT(D40)` | `=ROUND_DYNAMIC(B40)` | $1,000 |  | \="ISTEXT(B40)= " & ISTEXT(B40) |  |
| \=IF(D41=E41, "✓", "✗") | €4,511 | `=FORMULATEXT(D41)` | `=ROUND_DYNAMIC(B41)` | €4,500 |  | \="ISTEXT(B41)= " & ISTEXT(B41) |  |
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
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
| Section 6: look like numbers but should not be simplified |  |  |  |  |  | *//format E81 as plain text* |  |
|  | **Input** | **Formula** | **Result** | **Expected** |  |  |  |
| \=IF(D65=E65, "✓", "✗") | 416 555 1234 | `=FORMULATEXT(D65)` | `=ROUND_DYNAMIC(B65:B82)` | 416 555 1234 |  |  |  |
| \=IF(D66=E66, "✓", "✗") | 1 416 555 1234 | *(spills)* | 1 416 555 1234 | 1 416 555 1234 |  |  |  |
| \=IF(D67=E67, "✓", "✗") | 416-555-1234 | *(spills)* | 416-555-1234 | 416-555-1234 |  |  |  |
| \=IF(D68=E68, "✓", "✗") | (416) 555-1234 | *(spills)* | (416) 555-1234 | (416) 555-1234 |  |  |  |
| \=IF(D69=E69, "✓", "✗") | (416)555-1234 | *(spills)* | (416)555-1234 | (416)555-1234 |  |  |  |
| \=IF(D70=E70, "✓", "✗") | @2020vision | *(spills)* | @2020vision | @2020vision |  |  |  |
| \=IF(D71=E71, "✓", "✗") | 1-800-555-0199 | *(spills)* | 1-800-555-0199 | 1-800-555-0199 |  |  |  |
| \=IF(D72=E72, "✓", "✗") | 192.168.0.1 | *(spills)* | 192.168.0.1 | 192.168.0.1 |  |  |  |
| \=IF(D73=E73, "✓", "✗") | 2001:db8::1 | *(spills)* | 2001:db8::1 | 2001:db8::1 |  |  |  |
| \=IF(D74=E74, "✓", "✗") | https://example.com/item/123 | *(spills)* | https://example.com/item/123 | https://example.com/item/123 |  |  |  |
| \=IF(D75=E75, "✓", "✗") | 311@example.com | *(spills)* | 311@example.com | 311@example.com |  |  |  |
| \=IF(D76=E76, "✓", "✗") | ISBN 978-0-306-40615-7 | *(spills)* | ISBN 978-0-306-40615-7 | ISBN 978-0-306-40615-7 |  |  |  |
| \=IF(D77=E77, "✓", "✗") | M5V 2T6 | *(spills)* | M5V 2T6 | M5V 2T6 |  |  |  |
| \=IF(D78=E78, "✓", "✗") | SW1A 1AA | *(spills)* | SW1A 1AA | SW1A 1AA |  |  |  |
| \=IF(D79=E79, "✓", "✗") | 90210-1234 | *(spills)* | 90210-1234 | 90210-1234 |  |  |  |
| \=IF(D80=E80, "✓", "✗") | Call 416-555-1234 | *(spills)* | Call 416-555-1234 | Call 416-555-1234 |  |  |  |
| \=IF(D81=E81, "✓", "✗") | 1 234 567 | *(spills)* | 1,000,000 | 1,000,000 |  |  |  |
| \=IF(D82=E82, "✓", "✗") | 90210 | *(spills)* | 90000 | 90000 |  |  |  |
|  |  |  |  |  |  |  |  |
| Section 7: simplifying numbers inside text cells |  |  |  |  |  |  |  |
|  | **Input** |  | **Result** | **Expected** |  |  |  |
| \=IF(D86=E86, "✓", "✗") | Call 416-555-1234 about 1,613,245 units |  | `=ROUND_DYNAMIC(B86:B100)` | Call 416-555-1234 about 1,500,000 units |  |  |  |
| \=IF(D87=E87, "✓", "✗") | (416) 555-1234 ordered 918,554 |  | (416) 555-1234 ordered 900,000 | (416) 555-1234 ordered 900,000 |  |  |  |
| \=IF(D88=E88, "✓", "✗") | Fax 416.555.1234, 427,808 pages |  | Fax 416.555.1234, 450,000 pages | Fax 416.555.1234, 450,000 pages |  |  |  |
| \=IF(D89=E89, "✓", "✗") | Dial 1-800-555-0199 for 263,114 refunds |  | Dial 1-800-555-0199 for 250,000 refunds | Dial 1-800-555-0199 for 250,000 refunds |  |  |  |
| \=IF(D90=E90, "✓", "✗") | Host 192.168.0.1 served 1,482,391 requests |  | Host 192.168.0.1 served 1,500,000 requests | Host 192.168.0.1 served 1,500,000 requests |  |  |  |
| \=IF(D91=E91, "✓", "✗") | Host 2001:db8::1 served 947,310 requests |  | Host 2001:db8::1 served 950,000 requests | Host 2001:db8::1 served 950,000 requests |  |  |  |
| \=IF(D92=E92, "✓", "✗") | See https://example.com/item/123 for 431,552 rows |  | See https://example.com/item/123 for 450,000 rows | See https://example.com/item/123 for 450,000 rows |  |  |  |
| \=IF(D93=E93, "✓", "✗") | Mail 311@example.com about 270,987 orders |  | Mail 311@example.com about 250,000 orders | Mail 311@example.com about 250,000 orders |  |  |  |
| \=IF(D94=E94, "✓", "✗") | ISBN 978-0-306-40615-7 sold 90,114 copies |  | ISBN 978-0-306-40615-7 sold 90,000 copies | ISBN 978-0-306-40615-7 sold 90,000 copies |  |  |  |
| \=IF(D95=E95, "✓", "✗") | Ship to M5V 2T6, 1,506,220 parcels |  | Ship to M5V 2T6, 1,500,000 parcels | Ship to M5V 2T6, 1,500,000 parcels |  |  |  |
| \=IF(D96=E96, "✓", "✗") | Ship to SW1A 1AA, 1,002,466 parcels |  | Ship to SW1A 1AA, 1,000,000 parcels | Ship to SW1A 1AA, 1,000,000 parcels |  |  |  |
| \=IF(D97=E97, "✓", "✗") | Ship to 90210-1234, 440,193 parcels |  | Ship to 90210-1234, 450,000 parcels | Ship to 90210-1234, 450,000 parcels |  |  |  |
| \=IF(D98=E98, "✓", "✗") | Call 416 555 1234 about 281,745 units |  | Call 400 550 1,000 about 300,000 units | Call 400 550 1,000 about 300,000 units |  |  |  |
| \=IF(D99=E99, "✓", "✗") | In 2024 12 stores opened |  | In 2,000 10 stores opened | In 2,000 10 stores opened |  |  |  |
| \=IF(D100=E100, "✓", "✗") | 978-0-306-40615-7 sold 90,114 copies |  | 1,000-0-300-40,000-7 sold 90,000 copies | 1,000-0-300-40,000-7 sold 90,000 copies |  |  |  |
