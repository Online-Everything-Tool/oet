# TODO List - OET Project

**Current Major Focus:** Implement Inter-Tool Data Exchange (ITDE) now that core tools are stateful.

**Guiding Principles for ITDE (Recap):**

- **Full Statefulness Achieved (Mostly):** Core tools now persist relevant inputs, settings, and primary output references (e.g., `processedFileId`, `outputFilename`, `outputValue`) in Dexie via `useToolState`. They load this state and display output without unnecessary auto-processing.
- **ITDE Architecture:**
  - `MetadataContext`: Global access to all tools' `metadata.json` (especially `inputConfig`, `outputConfig`).
  - `useItdeDiscovery()`: Hook for the source tool to find compatible target tools.
  - `useItdeTargetHandler()`: Hook for target tools to detect and manage incoming ITDE messages.
  - `sessionStorage` message: `{ to: "target-directive", from: "source-directive"}`.
  - ITDE Modal: Target tool presents Accept/Ignore/Defer options.

---

## I. Inter-Tool Data Exchange (ITDE) Implementation

- **Phase 1: Core Infrastructure & Basic "Ignore" Flow**

  - [ ] **Create `MetadataContext.tsx`**:
    - Provider loads all `public/api/tool-metadata/*.json`.
    - Exposes `getToolMetadata(directive)`, `getAllToolMetadataArray()`.
  - [ ] **Create `sessionStorageUtils.ts`**:
    - Functions: `setItdeMessage(payload)`, `getItdeMessage()`, `clearItdeMessage()`.
  - [ ] **Create `useItdeDiscovery.ts` Hook**:
    - Input: `currentToolOutputConfig`, `currentSelectedOutputFiles?: StoredFile[]`.
    - Consumes `MetadataContext`. Matches output to other tools' `inputConfig`.
    - Handles `fileCategory="*"` (e.g., from `file-storage`) by checking actual MIME types of selected files.
    - Returns array of compatible target tools.
  - [ ] **Implement "Send To..." Button UI**:
    - In a shared component or tool clients where output exists.
    - Uses `useItdeDiscovery`. On selection, calls `setItdeMessage`.
    - Handles transient outputs (e.g., unsaved `image-montage` canvas) by generating a temporary Dexie file and passing `tempFileId`.
  - [ ] **Create `useItdeTargetHandler.ts` Hook**:
    - Input: `targetToolDirective`, `onAcceptDataRequest: (payload) => void`.
    - Manages "Incoming Data" modal state.
  - [ ] **Create `IncomingDataModal.tsx` Shared Component**:
    - Displays message. Buttons: "Accept", "Ignore", "Defer".
    - "Ignore" calls `clearItdeMessage`.
  - [ ] **Integrate with 2-3 Tools for Phase 1 (e.g., `image-flip` -> `image-gray-scale`)**: Implement "Ignore" fully. Show modal.

- **Phase 2: Implement "Accept" & "Defer" Logic**

  - [ ] **Refine `onAcceptDataRequest` in `useItdeTargetHandler`**.
  - [ ] **Target Tool "Accept" Implementation:**
    - Tool's `onAcceptData` callback:
      - Uses `MetadataContext` for source tool's `outputConfig`.
      - Fetches source tool's state (or uses `tempFileId`).
      - Extracts output reference/data.
      - Sets data as its _own input_ (`setSelectedFileId`, `setInputText`, etc.).
      - Triggers its own processing logic.
  - [ ] **Handle "Merge" Scenarios** (e.g., `image-montage` accepting an image to add).
  - [ ] **Handle "Batch" Scenarios** (e.g., tool accepting multiple files from `file-storage`).
  - [ ] **Implement "Defer" Logic** (how deferred messages are managed/re-presented).

- **Phase 3: Cleanup & Refinements**
  - [ ] **Temporary ITDE File Cleanup**: Via `FileLibraryContext.cleanupTemporaryFiles` or other robust method.
  - [ ] **Error Handling & User Feedback** for all ITDE steps.
  - [ ] **UI/UX Polish** for "Send To..." and "Incoming Data" experiences.

## II. Finalizing Remaining Tool Statefulness & Polish

- [ ] **`zip-file-explorer`**:
  - Verify `selectedFileId` (for the input zip) and UI state (filters, `expandedFolderPaths`, `selectedPaths`) are robustly persisted with `useToolState`.
  - Its `outputConfig` for `selectionReferenceList` using `selectedPaths` is good for ITDE. The actual extraction logic will be part of the _target tool's_ "Accept" handler when receiving from `zip-file-explorer`.
- **Review & Polish Already "Done" Tools:**
  - Quick pass over tools marked as complete (e.g., `image-flip`, `image-gray-scale`, `image-montage`, text tools) to ensure consistency with the "full statefulness" pattern (especially regarding `outputFilename` if applicable, and how `processedFileId` is handled vs. live canvas for image tools).
  - Ensure all relevant `outputConfig` entries in `metadata.json` are accurate for ITDE (e.g., `textStateKey` or `fileIdStateKey`).

## III. General UI/UX & Other Enhancements

- [ ] **Create Site Footer**: Standard links (Privacy, Terms, GitHub).
- [ ] **Static HTML Pages**: `privacy.html`, `terms.html` in `/public`.
- [ ] **Refine AI Build Tool Prompts**: Update for new state patterns, ITDE awareness, use of shared components.

## IV. Bugs & Minor Fixes

- [ ] **Canvas Sizing/Clipping Review (`image-montage`)**: Double-check after padding changes that final blobs aren't clipped.
- [ ] **FileSelectionModal Flicker**: Monitor if it reappears; if so, investigate further with logs.
- [ ] **`useImageProcessing` `toolTitle` prop**: `ImageGrayScaleClient` calls it with `toolRoute` instead of `toolTitle`. Standardize or update hook. (Minor).
- [ ] **ESLint Warnings**: Address remaining legitimate warnings (unused vars, hook dependencies) where fixes don't cause regressions.

---
