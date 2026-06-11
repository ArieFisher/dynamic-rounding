# Sprint Log: feasibility-spike

**Plan:** docs/sprint-plans/grid-support.md
**Sprint goal:** Resolve the two unknowns that could force a re-architecture before any committed code assumes them away: (1) real grid DOM structure, (2) whether in-place text replacement survives the host framework's re-render.
**Date:** 2026-06-11
**Result:** Amend

## Method

Live DevTools/console investigation on a real **Databricks SQL result grid**
(`dg--` classes; a React app with row virtualization). A numeric cell was
located, its text overwritten from the console, and the grid was then scrolled,
re-sorted, and column-resized while observing whether the overwrite survived.
(Console-only, throwaway — no production code.)

## Q1 — Real DOM structure (confirmed, with selector deltas)

Ancestor chain from a numeric cell outward:

| Level | role | class | notes |
|---|---|---|---|
| cell | `cell` | `dg--cell dg--cell-lite` | `display:grid`; carries `data-row`, `data-col`, `data-index`, `data-cell-id` |
| row | `row` | `dg--virtual-row` | `display:flex`; "virtual" → row virtualization |
| scroll container | `grid` | `dg--grid-container dg--grid-scroll-container` | |
| wrapper | `table` | `dg--table-wrapper` | outermost grid root |

- **Stable row id EXISTS** (`data-row` / `data-index` on each cell). The plan
  flagged a missing stable id as a possible confirmed limitation — it is not a
  limitation here; reset/stitching has a real key.
- **Delta vs plan D3:** cells are `role="cell"`, **not** `role="gridcell"`. The
  planned cell selector `[role="gridcell"]` would match nothing on Databricks.
  Rows are `.dg--virtual-row` / `role="row"`; the stable key attribute is
  `data-row` / `data-index`, not `data-row-index`.

## Q2 — Framework clobbering (the blocker)

Overwrote a visible numeric cell via `cell.textContent = '…'`, then:

| Action | Result | Interpretation |
|---|---|---|
| Leave untouched (several minutes) | **persists** | Host does NOT proactively re-render visible cells on a timer — the "100 ms re-apply race" risk the plan worried about is LOW for untouched visible cells. |
| Scroll cell off-screen and back | reverts to original | Virtualization recycles the row node — **expected**; this is exactly what the sprint-4 re-apply observer is designed for. |
| Scroll while cell stays on screen | persists | In-viewport cells are stable. |
| Resize a *different* column | persists | Unrelated re-renders don't touch the cell. |
| **Resize the overwritten cell's column** | **React reconciler crash** | `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node`, thrown inside React's reconciler, tripping an error boundary that blanks the results panel ("Unable to load bottom panel"). |

**Root cause.** `cell.textContent = value` removes the cell's existing text node
and inserts a new one. React still holds a fiber reference to the original text
node; the next time it reconciles that cell (column resize, sort, any
re-render), it tries to remove a node that is no longer a child → `NotFoundError`
→ error boundary → the host grid panel is destroyed.

A rounding tool that can crash the host application's results panel is not
shippable. This is the in-place write model the plan anticipated might fail
("…the in-place write model is not viable and must change").

## Verdict — AMEND sprints 2–4

The in-place `cell.textContent` write model (D3 `setText`, sprint-3) is **not
viable** on framework-managed virtualized grids: it can crash the host app. The
revised plan (`/sprint-plan`) must:

1. **Selectors:** use `role="cell"` / `.dg--cell` and `data-row` / `data-index`;
   do not rely on `role="gridcell"` / `data-row-index`.
2. **Write model:** replace `cell.textContent = …` with **text-node `nodeValue`
   patching** — locate the cell's existing (deepest non-empty) text node and set
   its `.nodeValue`, never replacing the node. This is framework-agnostic and
   **validated below**: it preserves the node identity the framework tracks, so
   no reconciler crash. An overlay-rendering approach was considered and rejected
   as fragile and too host-specific.
3. **Virtualization:** keep the sprint-4 re-apply observer; it drives the
   `nodeValue` write model. **Caveat (new):** an in-place **sort** reverts cell
   text without adding/removing child nodes, so a `childList`-only observer
   (sprint 4 as drafted) may miss it — the revised plan should also watch
   `characterData` mutations, or accept sort as a known re-apply gap.

## Micro-spike: text-node `nodeValue` patching — VALIDATED

Patched a numeric cell's existing text node via `textNode.nodeValue = '…'`
(node identity preserved) and repeated the Q2 actions:

| Action | Result |
|---|---|
| Leave untouched | **persists** |
| Resize a *different* column | **persists** |
| **Resize the patched cell's column** | **persists — no crash** (the action that crashed the `textContent` model) |
| Scroll cell horizontally off and back | reverts (column virtualization — out of scope per plan §8) |
| Sort the column | reverts (in-place re-render; see caveat above) |
| Scroll all patched cells vertically off-screen (a few rows) and back | reverts (row recycle — sprint-4 territory) |

Observed recycling detail: patched cells persist even when individually scrolled
out, as long as ≥ 1 patched cell remains in the render buffer; only once every
patched cell leaves the buffer does the framework recycle and revert them. This
is ordinary virtualized-render-buffer behavior.

**Conclusion:** `nodeValue` patching is React-safe (no crash on any re-render,
including the previously-fatal column resize) and framework-agnostic. Reverts
occur only on genuine node recycling — exactly the case the sprint-4 re-apply
observer handles. This becomes the write model for the revised sprints 3–4,
replacing in-place `textContent` replacement.

## Note on Sprint 1

Sprint 1 (`grid-detection`, PR #112) is **unaffected** by this verdict — it only
detects and badges grids; it performs no writes. It can merge independently.
