# TODO List - OET Project

**Current Major Focus:** Achieve "Full Statefulness" for all core tools and then implement Inter-Tool Data Exchange (ITDE).

**Guiding Principles (Recap):**

- **Full Statefulness:** Each tool's relevant inputs, settings, AND its primary output (or a reference like `processedFileId` and `outputFilename`) must be persisted in its Dexie state record via `useToolState`.
- **Load, Don't Auto-Process:** Tools should load their complete persisted state (inputs and outputs) and display them. Automatic re-processing on load should only occur if essential inputs are missing or if state indicates the output is stale/not yet generated for the loaded inputs.
- **Explicit User Actions:** Output generation/updates are primarily driven by explicit user changes to inputs/settings or by "Save/Update" actions, not just by loading the page.
- **ITDE Architecture:**
  - `MetadataContext`: Global access to all tools' `metadata.json` (especially `inputConfig`, `outputConfig`).
  - `useItdeDiscovery()`: Hook for the source tool to find compatible target tools for its output.
  - `useItdeTargetHandler()`: Hook for target tools to detect and manage incoming ITDE messages from `sessionStorage`.
  - `sessionStorage` message: Simple, like `{ to: "target-directive", from: "source-directive", sourceOutputKey: "key_from_source_output_config" }`. For unsaved source outputs (e.g., live canvas from montage), a `tempFileId` might be included, referencing a temporary Dexie entry.
  - ITDE Modal: Target tool presents Accept/Ignore/Defer options.
    - "Accept": Fetches source state using message details, extracts output reference, sets it as its own input, then triggers its own processing.
    - "Defer": Important for cases like `image-montage` where its own output might be a temporary file that shouldn't be lost.

---

## I. Complete "Full Statefulness" Refactor for Remaining Tools

_(Goal: Each tool client uses `useToolState` to persist all relevant inputs, settings, `selectedFileId`(s), `processedFileId`, and `outputFilename` as applicable. No auto-generation on load if output state exists. Forgo URL params for image/file-based tools unless specifically beneficial for text components of their state. All "Save" actions for tools that generate files should be explicit and involve filename prompting where appropriate, defaulting to permanent saves.)_

- **Tools to Refactor (prioritizing those that produce distinct file/text outputs):**

  - [ ] **`image-gray-scale`**:
    - State: `selectedFileId`, `processedFileId`, `outputFilename`. (No `autoSaveProcessed`).
    - Implement Save/Update/Save As (via FilenamePrompt), Download.
  - [ ] **`hash-generator`**:
    - State: `inputText`, `algorithm`, `outputValue` (the hash), `lastLoadedFilename` (if input from file), `outputFilename` (for saved hash text).
    - Persist `outputValue`. Calculate hash when `inputText` or `algorithm` changes.
    - Update output actions (Download, Save to Lib) to use `outputValue` and prompt for filename.
  - [ ] **`json-validate-format`**:
    - State: `jsonInput`, `indent`, `sortKeys`, `outputValue` (formatted JSON), `isValid`, `error`, `lastLoadedFilename`, `outputFilename`.
    - Persist `outputValue`. Validate/format on explicit button click or when settings change _if_ valid input exists.
    - Update output actions.
  - [ ] **`password-generator`**:
    - State: `length`, `includeUppercase`, `includeLowercase`, `includeNumbers`, `includeSymbols`, `generatedPassword`. (No file output, but `generatedPassword` is the key "output").
    - Persist `generatedPassword`. Only re-generate on explicit click or if options change _and_ no password was previously generated for current options.
  - [ ] **`text-counter`**:
    - State: `inputText`, `searchText`, `lastLoadedFilename`. (Counts are derived; no direct "output file" to persist beyond input).
    - Ensure robust state loading.
  - [ ] **`text-reverse`**:
    - State: `inputText`, `reverseMode`, `outputValue` (reversed text), `outputFilename`.
    - Persist `outputValue`. Reverse when `inputText` or `reverseMode` changes.
    - Update output actions.
  - [ ] **`text-strike-through`**:
    - State: `inputText`, `skipSpaces`, `color`. (Output is visual; no specific `outputValue` string to persist for ITDE unless we define one).
    - Ensure robust state loading.
  - [ ] **`url-encode-decode`**:
    - State: `text` (input), `operation`, `encodeMode`, `outputValue`, `outputFilename`.
    - URL params (`text`, `operation`) can still influence initial state if desired.
    - Persist `outputValue`. Process when inputs/settings change.
    - Update output actions.
  - [ ] **`zip-file-explorer`**:
    - State: `selectedFileId` (for the input zip), UI state (filters, expansions).
    - This tool's "output" for ITDE is complex: it would be a _selection_ of internal files. The `outputConfig` would be `selectionReferenceList`. The state would need to hold `selectedInternalPaths: string[]`.
    - Primary Goal: Persist `selectedFileId` and UI state. ITDE for its output is a more advanced step.

- **Tools Already Refactored (Verify against "Full Statefulness" principles):**

  - [x] `image-flip`
  - [x] `image-montage`
  - [x] `base64-encode-decode`
  - [x] `case-converter`
  - [x] `color-converter`
  - [x] `crypto-wallet-generator` (Primarily settings; output is transient display)
  - [x] `file-storage` (Its state _is_ its output for ITDE: `selectedFileIds`)
  - [x] `image-storage` (Similar to `file-storage`)
  - [x] `linkedin-post-formatter` (State is editor JSON; output is generated Unicode text)

- **Tools to Skip (No significant state/output for persistence beyond current setup):**
  - `emoji-explorer`
  - `html-entity-explorer`

## II. Inter-Tool Data Exchange (ITDE) Implementation

- **Phase 1: Core Infrastructure & Basic "Ignore" Flow**

  - [ ] **Create `MetadataContext.tsx`**:
    - Provider loads all `public/api/tool-metadata/*.json`.
    - Exposes `getToolMetadata(directive)`, `getAllToolMetadataArray()`.
  - [ ] **Create `sessionStorageUtils.ts`**:
    - `setItdeMessage(payload: {to, from, sourceOutputKey, tempFileId?})`, `getItdeMessage()`, `clearItdeMessage()`.
  - [ ] **Create `useItdeDiscovery.ts` Hook**:
    - Input: `currentToolOutputConfig`, `currentSelectedOutputFiles?: StoredFile[]`.
    - Consumes `MetadataContext`. Matches output to other tools' `inputConfig`.
    - Handles `fileCategory="*"` from `file-storage` by checking actual MIME types of selected files.
    - Returns compatible target tools.
  - [ ] **Implement "Send To..." Button UI**:
    - Uses `useItdeDiscovery`. On selection, calls `setItdeMessage`.
    - For canvas tools (e.g., unsaved `image-montage`): generate blob, save as _temporary_ file, pass `tempFileId` in message.
  - [ ] **Create `useItdeTargetHandler.ts` Hook**:
    - Input: `targetToolDirective`, `onAcceptDataRequest: (payload) => void`.
    - Manages "Incoming Data" modal state.
  - [ ] **Create `IncomingDataModal.tsx`**:
    - Displays message. Buttons: "Accept", "Ignore", "Defer".
    - "Ignore" calls `clearItdeMessage`.
  - [ ] **Integrate with 2-3 Tools for Phase 1 (e.g., `image-flip` -> `image-gray-scale`)**: Implement "Ignore" fully.

- **Phase 2: Implement "Accept" & "Defer" Logic**
  - [ ] **Target Tool "Accept" Logic:**
    - `onAcceptDataRequest` callback uses message payload to fetch source tool's state, get output reference (file ID, text key, or temp file ID), fetch actual data, set as own input, then triggers own processing.
  - [ ] **Handle "Merge/Batch" Scenarios**: (e.g., `image-montage` accepting an image to add, or a tool accepting multiple files from `file-storage`). Message payload or `outputConfig` may need to indicate list vs. single item.
  - [ ] **Implement "Defer" Logic**.
  - [ ] **Temporary ITDE File Cleanup**: Via `FileLibraryContext.cleanupTemporaryFiles`.

## III. General UI/UX & Other Enhancements

- [ ] **FavoritesContext to Dexie**.
- [ ] **Create Site Footer** (Privacy, Terms, GitHub).
- [ ] **Static HTML Pages** (`privacy.html`, `terms.html`).
- [ ] **Refine AI Build Tool Prompts** (for new state patterns, ITDE awareness).

## IV. Bugs & Minor Fixes

- [ ] **Canvas Sizing/Clipping Review**: After `image-montage` padding changes, re-check if any clipping occurs with extreme tilts, especially on the final generated blob.
- [ ] **FileSelectionModal Flicker**: Re-investigate with new logs if the issue persists after other refactors stabilize component re-renders. _(Marking as lower priority if current fixes mitigated it significantly)_.
- [ ] **Review `isCurrentOutputPermanentInDb` vs. `manualSaveSuccessFeedback` vs. `toolState.autoSaveProcessed` (now removed for montage) interaction for the "Saved to Library" badge across all image tools to ensure consistency and clarity.**

---
