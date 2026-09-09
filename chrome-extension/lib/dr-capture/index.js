/**
 * DynamicRounding lib/dr-capture package bundle.
 *
 * Loaded LAST within lib/dr-capture, after state.js and render.js. Both
 * declare their functions as bare top-level names on the shared global scope
 * (call sites keep consuming those bare names unchanged). This file adds one
 * more thing: a single DR_CAPTURE object that groups every public function
 * the package exposes, mirroring DR_NUMBER/DR_TABLE/DR_SIMPLIFY.
 *
 * No logic lives here — this is a pure re-export list. Do not add behavior.
 */

const DR_CAPTURE = {
  // state.js
  collectCaptureState,
  // render.js
  buildCaptureDocument,
  filenameFor: captureFilenameFor,
  escapeHtml,
};
