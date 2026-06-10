# Detecting Web-Based Data Grids (Databricks SQL & others)

Research notes on identifying non-standard "data grid" tables in modern web apps,
prompted by inspecting the Databricks SQL results window. Relevant to the Chrome
extension's table detection/scraping logic.

## Databricks SQL results structure

The results "table" is **not** a single `<table>` element. It's a virtualized
grid split into pinned and scrollable parts for high-performance scrolling:

- **Main wrapper**: `.dg--table-wrapper` — `role="table"`
- **Pinned columns** (e.g. row numbers): `.dg--grid-container.dg--pinned-grid` — `role="grid"`
- **Scrollable data**: `.dg--grid-container.dg--grid-scroll-container` — `role="grid"`

Targeting cheatsheet:

| Goal | Selector |
| --- | --- |
| Entire table area | `.dg--table-wrapper` |
| Actual data values | inside `.dg--grid-scroll-container` |
| Row numbers / index | inside `.dg--pinned-grid` |

The `dg--` prefix likely stands for "Data Grid" and is Databricks-specific. To
reduce false positives, scope to the results pane (e.g. `.results .dg--table-wrapper`)
and/or require the co-occurrence of a pinned + scrollable container under the same
parent, optionally paired with a container like `.DataViewTable`.

## Generic heuristics for identifying data grids

These grids often skip the `<table>` tag and sometimes ARIA roles, and only
render visible rows (virtualization). Detect them structurally:

1. **Repetitive siblings** — a parent with many (>10) children sharing identical
   class names / DOM structure; uniform row heights and uniform cell widths
   across rows.
2. **CSS layout** — `display: grid` (check `grid-template-columns`, e.g.
   `repeat(5, 1fr)`), or `display: flex` with `flex-direction: column` as the
   container and flex rows as children.
3. **Virtualization markers** — rows positioned via `transform: translateY(...)`
   or `top: ...px` rather than natural flow; `position: absolute` rows inside a
   relative container; large `scrollHeight` vs small `offsetHeight`.
4. **Interaction markers** — `wheel`/`scroll` listeners for lazy loading;
   focusable cells with `tabindex="0"` or `-1` even without ARIA.

### Example detection script

```js
function findNonStandardTables() {
  const containers = document.querySelectorAll('div, section');
  return Array.from(containers).filter(el => {
    const children = el.children;
    if (children.length < 5) return false;
    const styles = window.getComputedStyle(el);
    const firstChildStyles = window.getComputedStyle(children[0]);
    const isGrid = styles.display === 'grid';
    const areChildrenFlex =
      firstChildStyles.display === 'flex' || firstChildStyles.display === 'grid';
    const heights = Array.from(children).slice(0, 5).map(c => c.offsetHeight);
    const isUniform = heights.every(h => h === heights[0] && h > 0);
    return (isGrid || areChildrenFlex) && isUniform;
  });
}
```

**Most reliable generic pattern:** repetitive `display: flex` rows inside a
container with a stable scroll height.

## Same pattern across other platforms

The pinned + scrollable split is the industry standard for web SQL editors and
spreadsheets, not unique to Databricks:

- **AG Grid** (financial dashboards, Bloomberg, J.P. Morgan): pinned
  `.ag-pinned-left-cols-container`, scrollable `.ag-center-cols-viewport`.
- **Azure Data Studio / VS Code** (`monaco-workbench`): SlickGrid/Monaco grid
  with row headers in a separate DOM tree.
- **Google Sheets / Excel Online**: "Freeze Panes" creates synchronized
  viewports kept in sync with `transform: translate3d`.
- **AWS Console** (Cloudscape / `awsui`): `.awsui-table-wrapper`,
  `.awsui-table-sticky-holder`.

### Distinguishing data grids from layout grids

Data grids (unlike plain CSS `display: grid` layouts) almost always show:

- **Virtualization** — only visible rows rendered; DOM nodes recycled on scroll.
- **Role attributes** — explicit `role="grid"` / `role="rowgroup"`.
- **Synchronized scrolling** — scrolling one container programmatically drives
  `scrollTop` / `scrollLeft` on another.

**Bottom line:** look for the **co-occurrence** of a pinned container and a
scrollable container within the same parent.

## Open follow-up questions

- How to verify scrolling is synchronized between the pinned and scrollable grids.
- Which specific ARIA attributes to rely on for robust detection.
- A script to extract data from both pinned and scrollable sections and stitch
  rows back together.
