# TODO List - OET Project

**Current Major Focus:** Finalize core tool ITDE capabilities and refine storage components.

**Guiding Principles for ITDE (Recap):**

- Core tools persist relevant state in Dexie via `useToolState`.
- ITDE Architecture: `MetadataContext`, `useItdeDiscovery`, `useItdeTargetHandler`, `sessionStorage` signals, ITDE Modals.

---

## I. Inter-Tool Data Exchange (ITDE) - Finalization & Testing

- **Phase 1 & 2: Core Infrastructure & Accept/Defer Logic - LARGELY COMPLETE**
  - [x] `MetadataContext.tsx`: Implemented.
  - [x] `sessionStorageUtils.ts`: Implemented.
  - [x] `useItdeDiscovery.ts`: Implemented and refined (including "match all" for `fileCategory:"*"`).
  - [x] `SendToToolButton.tsx`: Implemented.
  - [x] `useItdeTargetHandler.ts`: Implemented.
  - [x] `IncomingDataModal.tsx`: Implemented (opacity adjusted).
  - [x] `ItdeAcceptChoiceModal.tsx`: New shared component created and implemented for `image-montage`.
- **Tool-Specific ITDE Integration - IN PROGRESS/MOSTLY DONE:**
  - [x] `image-flip`: ITDE Send/Receive implemented.
  - [x] `image-gray-scale`: ITDE Send/Receive implemented.
  - [x] `image-montage`: ITDE Send/Receive implemented (with choice modal).
  - [x] `base64-encode-decode`: ITDE Send/Receive implemented.
  - [x] `case-converter`: ITDE Send/Receive implemented.
  - [x] `hash-generator`: ITDE Send/Receive implemented.
  - [x] `json-validate-format`: ITDE Send/Receive implemented.
  - [x] `text-reverse`: ITDE Send/Receive implemented.
  - [x] `text-strike-through`: ITDE Receive implemented (output is Unicode copy).
  - [x] `file-storage`: ITDE Send implemented (dynamic types).
  - [x] `image-storage`: ITDE Send implemented (dynamic image types).
- **Phase 3: Cleanup & Refinements - ONGOING**
  - [x] Temporary ITDE File Cleanup: `cleanupOrphanedTemporaryFiles` implemented with "mark as temporary" logic. Robustness improved.
  - [ ] **Thorough End-to-End ITDE Testing:** Test various send/receive combinations between all ITDE-enabled tools.
  - [ ] Error Handling & User Feedback for all ITDE steps (review and enhance where needed).
  - [ ] UI/UX Polish for "Send To..." and "Incoming Data" experiences (review after full testing).

## II. Storage Component Refactoring & Deletion Logic - COMPLETE

- [x] **Generic `StorageClient.tsx`:** Created and implemented.
- [x] **`FileStorageClient.tsx`:** Refactored to use `GenericStorageClient`.
- [x] **`ImageStorageClient.tsx`:** Refactored to use `GenericStorageClient` with an adapter for image-specific listing and adding (via `FileLibraryContext`'s enhanced `addFile`).
- [x] **Deletion Logic:** Updated to "mark as temporary" then `cleanupOrphanedTemporaryFiles` in `FileLibraryContext.tsx` and utilized by storage clients.
- [x] **`FileLibraryContext.tsx` and `useImageThumbnailer.ts`:** Refactored to centralize thumbnail generation logic within `FileLibraryContext` using the dedicated hook. `ImageLibraryContext.tsx` simplified/potentially removed.

## III. UI/UX Enhancements & Polish

- [x] Button Flicker: Addressed for text tools and storage clients by relocating/memoizing button groups. (Marked as done for now, further finessing can be separate).
- [x] Filename Prompting: Refined logic for text tools and storage clients.
- [x] `IncomingDataModal.tsx` Opacity: Adjusted.
- [ ] **Standardize UI/UX for Controls:**
  - **Button Sizing, Coloring, and Placement:** Review all tools for consistency in button appearance (primary, secondary, neutral variants), sizes, and logical grouping/placement of action buttons (e.g., input actions, output actions, ITDE actions).
  - Review hover/focus/disabled states.
- [ ] **Textarea Flicker (Scrollbar):** Investigate strategies (min-height, overflow-y: scroll) to prevent layout shift when output textareas populate. (Low priority for now).
- [ ] **Create Site Footer:** Standard links (Privacy, Terms, GitHub).
- [ ] **Static HTML Pages:** `privacy.html`, `terms.html` in `/public`.

## IV. Bugs & Minor Fixes

- [ ] **`linkedin-post-formatter` Paste Handling:**
  - **Double Spacing Issue:** Investigate why pasted text with blank lines (intended as paragraph breaks) might not be rendering with the expected double line break visual separation in the editor after pasting. (Current paste handler treats each line as a new paragraph, but rendering might be collapsing empty paragraphs visually or `generateUnicodeText` might be over-trimming).
  - Revisit `editorProps.handlePaste` and `generateUnicodeText` if needed.
- [ ] **ESLint Warnings:** Address any remaining legitimate warnings (unused vars, hook dependencies) where fixes don't cause regressions. (Mostly done, but keep an eye out).

## V. Future Tool Development & Enhancements

- [ ] **`zip-file-explorer`**: Implement full functionality and ITDE (complex output).
- [ ] **Refine AI Build Tool Prompts**: Update for new state patterns, ITDE awareness, use of shared components, and generic storage client patterns.
- [ ] **"Recently Used" Widget (Thumbnail Re-integration):** Plan for re-introducing this feature, leveraging the `thumbnailBlob` now stored with image files.

---
