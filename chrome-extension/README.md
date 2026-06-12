# Dynamic Rounding - Chrome Extension

This extension allows users to apply the `ROUND_DYNAMIC` algorithm to arbitrary HTML tables on any website via a right-click context menu.

## Offset semantics

The extension uses the same offset model as the rest of the project. As of the `2026-05-28` release, the meaning of fractional offsets is sign-aware: `+0.5` rounds toward half of the next-larger order of magnitude, and `-0.5` rounds toward half of the current order. The result is also floored at the value's own order of magnitude so a large number can never collapse to zero. See the [root README](../README.md#declarating-a-lens) for the full parameter table and a worked example.

## Architecture Notes

### Safe DOM Text Replacement (The "Wikipedia Problem")

When updating numbers in an HTML table, a naive approach is to read `cell.innerText`, perform the rounding, and write back `cell.innerText = new_value`. However, this approach destroys any child HTML tags within the `<td>`.

During the development of this extension, we encountered a specific edge case common on data-heavy sites like Wikipedia. When extracting text and attempting to inject the rounded values back into the DOM, we found that tables often use **multiple invisible blocks or spans** to construct a single visual number. 

#### Why Sites Do This:
1. **Decimal Alignment:** To ensure that numbers align perfectly on their decimal points, a site might wrap the integer part, the decimal point, and the fractional part in separate `<span>` elements with specific CSS widths, visibilities, or text alignments.
   *Example:* `<span>+2</span><span style="visibility:hidden">.</span><span>5%</span>`
2. **Hidden Sort Keys:** Tables often embed machine-readable sort values directly alongside the visual text using `display: none` or hidden spans so that the table sorts correctly when a user clicks the column header.
   *Example:* `<span class="sortkey" style="display:none">700023000</span>+2.3%`

#### The Solution: Multi-Node Text Replacement
If a script naively overwrites the `innerText` when it fails to find a single clean text node to replace, it wipes out these structural spans. This leads to broken column widths, lost padding, and ruined text colors (since the alignment spans and CSS classes are removed).

To preserve the layout and keep column widths consistent, the extension uses a cross-node replacement algorithm:
1. We traverse the DOM tree of the cell using a `TreeWalker` to extract all `TextNodes`.
2. We concatenate their values into a single string to find the exact start and end indices of the target number.
3. We map those string indices back to the specific `TextNodes` that house the characters.
4. We inject the new rounded number into the first `TextNode` involved in the match and empty the subsequent nodes that contained the rest of the old number.

This guarantees that the structural HTML elements (like the spans dictating width, color, or alignment) are left completely untouched, preventing the table columns from resizing or breaking.

### Data Grids vs. HTML Tables

Not every "table" on the modern web is an HTML `<table>`. Many data-heavy apps render results as a **data grid** — a tabular UI built from plain `<div>` containers, usually **virtualized** (only the visible rows exist in the DOM; nodes are recycled as you scroll). Real-world examples:

- **Databricks SQL** — components prefixed `dg--` (`.dg--virtual-row`, `.dg--cell`).
- **AG Grid** (financial dashboards) — `.ag-center-cols-viewport` + a pinned `.ag-pinned-left-cols-container`.
- **AWS Console** — the **Cloudscape** design system (`awsui` / `.awsui-table-wrapper`).
- **Azure Data Studio / VS Code** — SlickGrid / Monaco grid (`monaco-workbench`).

The extension abstracts both shapes behind a `TableAdapter` interface (`content.js`), chosen by `makeAdapter(el)`:

- **`NativeTableAdapter`** (`<table>` elements) — reads `.rows`/`.cells`; writes use the cross-node replacement algorithm above (preserving `innerHTML` structure).
- **`GridAdapter`** (`<div>`-based grids, `isVirtualized() === true`) — stitches rows from the scrollable and pinned panes and exposes the same row/cell API.

#### Why grids need a different write model

A `<table>` cell can be rewritten via `innerHTML` safely. A framework-managed grid cell **cannot**: React (and similar) hold a fiber reference to the cell's text node, so replacing it (`innerHTML =`, `textContent =`, `removeChild`/`appendChild`) crashes the host app's reconciler on the next re-render (observed: a `removeChild NotFoundError` that tore down the results panel on column resize). Grid writes therefore patch the existing text node **in place** (`textNode.nodeValue = …`), preserving the node identity the framework tracks. (Mixed-text cells — e.g. numbers embedded in surrounding text or `<sup>` exponents — have no clean in-place rewrite and are currently skipped on grids; tracked as a follow-up.)

Because virtualized grids recycle rows on scroll and rewrite cells in place on sort, a debounced `MutationObserver` (watching both `childList` and `characterData`) re-applies rounding to rows that scroll into view and cells that a sort reverts.

### Data Grids vs. CSS Layout Grids

A `display: grid` / `flex` container is not necessarily a *data* grid — it might be a nav menu, a card layout, or a photo gallery. The extension deliberately does **not** badge or round these. Two things keep them out:

1. **Detection runs on demand, narrowly.** Only `role="grid"`/`role="table"` elements and known library grids (`dg--`, `ag-`) are tagged proactively. An unlabelled `<div>` structure is only ever evaluated when you **right-click inside it** (`findTargetTable` walks up calling `looksLikeGrid`).
2. **`looksLikeGrid` (`content.js`) applies a cheap-first ladder**, and a layout grid fails at least one rung:
   - ≥ N repetitive children sharing a class or child-shape (rejects ad-hoc layouts);
   - a consistent modal cell count across rows;
   - `display: grid`/`flex` (necessary, never sufficient on its own);
   - **at least one cell that parses as a finite number** — the decisive filter: nav menus, card grids, and galleries have no numeric cells and are rejected here;
   - column-width alignment (sampled column-0 cells must have matching widths) unless short-circuited by an ARIA role or library class.

Even past detection, rounding only ever writes cells whose text parses as a number, so a non-numeric layout grid produces no changes regardless.

**Caveat (by design):** a CSS layout grid that genuinely contains aligned numeric columns *will* qualify — at that point it is functionally a data grid, which is exactly the content a user would want rounded.
