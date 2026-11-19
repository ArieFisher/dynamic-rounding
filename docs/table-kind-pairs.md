# Table kind pairs

A native table and a grid are one product, so every table feature must give the same result on both kinds; [Table kinds behave alike](../AGENTS.md#table-kinds-behave-alike) holds the rule. Each table feature a page can use comes in a native form and a grid form, and the two forms of one feature make a pair. This table is the one list of pairs.

The extension's test suite reads the table: the Key column names a pair's comparison test, and the State column holds the result the test expects. Each comparison runs under the shipped defaults, and again with the first-row and first-column switches on and the top band rounding finer than the other band. The shipped defaults round both bands at the same offset, so only the second run shows a difference in which values feed the max magnitude.

- **same**: the comparison test finds no difference.
- **different**: the comparison test finds a difference. The note links the issue that holds it, or states after "Forced:" what in the markup forces it.
- **not yet tested**: no comparison test exists yet. The note states what the test needs.
- **no pair**: the feature has one form only, so nothing compares. The note states why.

A capture that shows a table feature this list lacks adds a row.

| Key | Feature | Native form | Grid form | State | Note |
| --- | --- | --- | --- | --- | --- |
| `data-cell` | Data cell | `<td>` in a `<tbody>` | `cell` role in a `rowgroup`, inside the `table` role | same | |
| `grid-cell` | Data cell of an interactive grid | `<td>` in a `<tbody>` | `gridcell` role in a `rowgroup`, inside the `grid` role | same | |
| `ungrouped-rows` | Rows with no body section | `<tr>` directly in the `<table>` | `row` role directly in the grid | same | |
| `column-header` | Header row in a head section | `<th>` cells in a `<thead>` | `columnheader` cells in a row outside every `rowgroup` | same | |
| `head-group` | Header row in a row group | `<th>` cells in a `<thead>` | `columnheader` cells in a row inside its own `rowgroup` | same | |
| `header-row-in-body` | Header row with no head section | a leading row of `<th>` cells, with no `<thead>` | a leading row of `columnheader` cells, with no `rowgroup` | same | |
| `row-header` | Row label | `<th scope="row">` | `rowheader` role | same | |
| `corner-cell` | Empty corner above the row labels | an empty `<td>` in the header row | an empty `cell` in the header row | same | |
| `body-groups` | Several body sections | several `<tbody>` | several `rowgroup` | same | |
| `footer-row` | Total row in a footer | `<tr>` in a `<tfoot>` | a row after the `rowgroup`, outside it | same | |
| `footer-group` | Total row in a footer group | `<tr>` in a `<tfoot>` | a row in its own `rowgroup`, after the body's | same | |
| `merged-across` | Cell merged across columns | `colspan` | `aria-colspan` | same | |
| `merged-down` | Cell merged down rows | `rowspan` | `aria-rowspan` | same | |
| `caption` | Caption | `<caption>` | `caption` role inside the grid | same | |
| `nested-table` | Table inside a cell | a `<table>` in a `<td>` | a grid in a `cell` | same | |
| `hidden-row` | Hidden row | `<tr hidden>` | `row` with `hidden` | same | |
| `hidden-cell` | Hidden cell | `<td hidden>` | `cell` with `hidden` | same | |
| `hidden-fragment` | Hidden text inside a visible cell, such as a sort key | a hidden `<span>` in a `<td>` | a hidden `<span>` in a `cell` | same | |
| `accessibility-artifact` | Table hidden from screen readers or drawn off-screen | `aria-hidden="true"` on the `<table>` or an ancestor, or an off-screen left offset | the same marks on the grid or an ancestor | same | |
| `column-group` | Column group | `<colgroup>` and `<col>` | none | no pair | The accessibility roles define no column element. |
| `header-reference` | Cell that names its header cells | `headers` on a `<td>` | none | no pair | The accessibility roles define no cell-to-header reference. |
| `column-index` | Column position on a grid that draws some of its columns | none | `aria-colindex` | no pair | A native table draws every column. |
| `row-index` | Row position on a grid that draws some of its rows | none | `aria-rowindex` and `aria-rowcount` | no pair | A native table holds every row. |
| `tree-rows` | Rows that expand and collapse | none | `treegrid` role with `aria-level` | no pair | HTML defines no tree table. |
| `column-first` | Cells listed column by column | none | generic children drawn side by side as columns, each holding one item per row | no pair | A native table lists its cells row by row. |
