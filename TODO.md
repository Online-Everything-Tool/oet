# TODO List - OET Project

**Current Major Focus:** Finalize core tool ITDE capabilities and refine storage components. Ensure AI Build Tool prompt is robust and maintainable.

**Guiding Principles for ITDE (Recap):**

- Core tools persist relevant state in Dexie via `useToolState`.
- ITDE Architecture: `MetadataContext`, `useItdeDiscovery`, `useItdeTargetHandler`, `sessionStorage` signals, ITDE Modals.

---

## I. Inter-Tool Data Exchange (ITDE) - Finalization & Testing

- **Phase 1 & 2: Core Infrastructure & Accept/Defer Logic - LARGELY COMPLETE**
  - [x] `MetadataContext.tsx`: Implemented.
  - [x] `sessionStorageUtils.ts`: Implemented.
  - [x] `useItdeDiscovery.ts`: Implemented and **REFINED** (stricter matching, handles no selection for reference types correctly).
  - [x] `SendToToolButton.tsx`: Implemented and **REFINED** (added `onBeforeSignal` prop, uses shared `Button` for dropdown).
  - [x] `useItdeTargetHandler.ts`: Implemented.
  - [x] `IncomingDataModal.tsx`: Implemented.
  - [x] `ItdeAcceptChoiceModal.tsx`: Implemented.
- **Tool-Specific ITDE Integration - MOSTLY COMPLETE / ONGOING REVIEW**
  - [x] `image-flip`: ITDE Send/Receive implemented & flicker fixed.
  - [x] `image-gray-scale`: ITDE Send/Receive implemented & flicker fixed.
  - [x] `image-montage`: ITDE Send implemented. **Receive logic for blank state fixed.**
  - [x] `base64-encode-decode`: ITDE Send/Receive implemented.
  - [x] `case-converter`: ITDE Send/Receive implemented.
  - [x] `hash-generator`: ITDE Send/Receive implemented.
  - [x] `json-validate-format`: ITDE Send/Receive implemented.
  - [x] `text-reverse`: ITDE Send/Receive implemented.
  - [x] `text-strike-through`: ITDE Receive implemented.
  - [x] `file-storage`: ITDE Send implemented. Lint fixes applied.
  - [x] `image-storage`: ITDE Send implemented. Lint fixes applied.
  - [x] **`zip-file-explorer`**: ITDE Send implemented (with `onBeforeSignal` for extraction to `extractedFileIds`). ITDE Receive implemented. Download Selected (single/multi-file zip) implemented. Clear logic refined. Reload issue fixed. MIME type handling improved.
- **Phase 3: Cleanup & Refinements - ONGOING**
  - [x] Temporary ITDE File Cleanup: `cleanupOrphanedTemporaryFiles` logic refined and integrated with tool clear/load actions.
  - [ ] **Review All Tools' `handleProcessIncomingSignal` (General Hardening):** Systematically verify each ITDE-receiving tool correctly validates incoming data and clears signals. (High Priority)
  - [ ] **Thorough End-to-End ITDE Testing:** Test various send/receive combinations between all ITDE-enabled tools.
  - [ ] UI/UX Polish for "Send To..." and "Incoming Data" experiences (review after full testing).

## II. Storage Component Refactoring & Deletion Logic - COMPLETE

- [x] **Generic `StorageClient.tsx`:** Created and implemented.
- [x] **`FileStorageClient.tsx`:** Refactored to use `GenericStorageClient`.
- [x] **`ImageStorageClient.tsx`:** Refactored to use `GenericStorageClient`.
- [x] **Deletion Logic:** Updated to "mark as temporary" then `cleanupOrphanedTemporaryFiles`.
- [x] **`FileLibraryContext.tsx` and `useImageThumbnailer.ts`:** Refactored.

## III. AI-Assisted Build Tool Enhancements - HIGH PRIORITY

- [ ] **Refactor `generate-tool-resources/route.ts` Prompt Construction:**
  - Move large instructional text blocks into separate Markdown (`.md`) files.
  - Load these `.md` files at runtime/build time for prompt assembly.
- [ ] **Review `CORE_CONTEXT_FILES` in `generate-tool-resources/route.ts`:**
  - Ensure comprehensive coverage of essential project-wide definitions, shared components, hooks, and types for new tool generation.

## IV. UI/UX Enhancements & Polish - MEDIUM PRIORITY

- [ ] **`ZipFileExplorerClient.tsx` - "Download Selected" Blink/Flicker:** Investigate and fix.
- [ ] **`ZipFileExplorerClient.tsx` - Date Filter UI Implementation:** Implement UI for existing date filter state.
- [ ] **`ZipFileExplorerClient.tsx` - Option for Flat vs. Structured Download in "Download Selected."**
- [ ] **General UI/UX Consistency Review (Buttons, Controls):** Broader pass across all tools.
- [ ] **Textarea Flicker (Scrollbar):** Investigate strategies to prevent layout shift. (Low priority).
- [ ] **`ZipFileExplorerClient.tsx` - Folder Checkbox Tri-State Behavior Refinement:** (Lower priority) Revisit for "Indeterminate -> Unchecked/Checked" cycling.

## V. Bugs & Minor Fixes

- [ ] **`linkedin-post-formatter` Paste Handling:** Investigate double spacing/paragraph break issues.
- [ ] **ESLint Warnings:** Address any remaining legitimate warnings after primary fixes.

## VI. Future Tool Development & Strategic Refactors - LOWER PRIORITY

- [ ] **`zip-file-explorer` - Multi-Select for File Type Filter.**
- [ ] **`zip-file-explorer` - Loading/Progress Indication for Large Extractions.**
- [ ] **"Recently Used" Widget (Thumbnail Re-integration):** Plan for re-introducing.
- [ ] **Application Error Boundary Strategy:** Implement/review.
- [ ] **`FileLibraryContext` - `cleanupOrphanedTemporaryFiles` Triggering Strategy:** Consider more systemic triggers.
- [ ] **Code Splitting & Bundle Size Review.**
- [ ] **Create Site Footer:** Standard links.
- [ ] **Static HTML Pages:** `privacy.html`, `terms.html` in `/public`.
- [ ] **Revisit `InlineFile` Handling for ITDE (if/when tools outputting direct blobs emerge).**

---
