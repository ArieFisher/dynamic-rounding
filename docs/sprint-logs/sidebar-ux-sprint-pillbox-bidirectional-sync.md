# Sprint Log: pillbox-bidirectional-sync

**Plan:** docs/sprint-plans/sidebar-ux-sprint.md
**Sprint goal:** When the user clicks the table's toggle (morph pill), reflect the new enabled state in the sidebar's main toggle checkbox — completing the two-way sync.
**Date:** 2026-06-23
**Result:** Completed

## Attempts

### Attempt 1
- **Developer:** ui-toggle.js sends `{ action: 'TABLE_TOGGLE_STATE', enabled: isTableRounded(table) }` after `runToggleAction(table)`, guarded by `if (sidebarOpen && lastRightClickedTable && table === lastRightClickedTable)` (both touch and mouse/keyboard branches). background.js relays via `chrome.runtime.sendMessage` (the established sidebar-delivery channel, same as CLOSE_SIDEBAR), guarded by `sidebarTabId !== null`. sidebar.js adds a `TABLE_TOGGLE_STATE` handler setting `enabledEl.checked = request.enabled` and calling `updateDisabledState()`.
- **Tests:** pass — 1052 passed, 0 failed (24 new). Behavioral coverage of AC1 (real click through handler), AC2 regression, AC3 guard branches, AC4 relay null/non-null logic.
- **Reviewer verdict:** APPROVE
- **Reviewer notes:** Adjudicated the test-writer's AC3 "gap" as a false alarm — the pre-existing pill-click rebind (`lastRightClickedTable = table` on a different table) is intended UX: clicking any pill while the sidebar is open rebinds the sidebar to that table, so sending its state is correct. RESET_SIDEBAR_TO_DEFAULTS fires before TABLE_TOGGLE_STATE, so the final checkbox is accurate. Relay channel consistent with CLOSE_SIDEBAR.

## Post-review fix-forward
- Renamed a duplicate test IIFE name (`pillbox_AC3_noLastRightClicked_noMessage` → `..._corollary`) introduced by the test-writer. No behavior change; suite stays green (1052 passed).

## PR
(see PR link in stack summary)

## Reviewer notes (non-blocking)
- The AC4 logic test runs an inline reproduction of the background handler, not background.js itself; mitigated by a paired static-source grep.
