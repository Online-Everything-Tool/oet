# TODO List

**Ongoing Gemini Note (Development Philosophy):**

- **Migrations:** "Fuck it! We'll do it live!" - We are not concerned about migrating IndexedDB schemas during active development. If schema changes require it, developers (and early testers) should expect to clear their application data. Proper migration paths will be considered closer to a production release, if necessary.
- **Code Inflation & Comments:** Fully uncomment and implement any logic that was commented out during development iterations (ensure code is fully 'inflated'). Keep necessary explanatory comments _within_ the final code concise and minimal, favoring self-documenting code.
- **Fuel:** Red wine preferred.

---

## Core Features & UX

- [x] **Refactor Core Storage:** Implement two-table Dexie schema (`files`, `history`). Update types (`StoredFile`, `HistoryEntry`).
- [x] **Refactor `FileLibraryContext`:** Align with new `files` schema. Stabilized callback dependencies.
- [x] **Refactor `HistoryContext`:** Align with new `history` schema and use Dexie directly. Stabilized callback dependencies. _(Note: Minor Dexie "Invalid key" error in `addHistoryEntry` to investigate later)._
- [x] **Refactor `ImageLibraryContext`:** Align with new `files` schema (filter by `type`). Stabilized callback dependencies.
- [x] **Update Basic Tool Clients:** Fix `addHistoryEntry` calls. _(Implicitly ongoing as tools are refactored)_
- [x] **Update Image Tool Clients (`ImageFlipClient`):**
  - [x] Use shared `Button` component.
  - [x] Integrate with enhanced `FileSelectionModal` (`mode`, `initialTab`).
  - [x] Implement user control over auto-saving processed output.
  - [x] Stabilize `useEffect` for image processing to prevent multiple runs.
- [x] **Update `file-storage` Tool (`FileStorageClient`):**
  - [x] Use shared `StorageControls` component.
  - [x] Integrate with enhanced `FileSelectionModal` (using `mode="addNewFiles"`).
  - [x] Remove direct `FileDropZone` from client UI.
  - [x] Use `file-icons-js` for previews in `FileListView`/`FileGridView`.
- [x] **Implement Shared UI Components:**
  - [x] `app/tool/_components/form/Button.tsx` (Standardized buttons).
  - [x] `app/tool/_components/form/Checkbox.tsx` (Standardized checkboxes).
  - [x] `app/tool/_components/storage/StorageControls.tsx` (Generic controls for storage views).
  - [x] `app/tool/_components/FileSelectionModal.tsx` (Refactored, stabilized, and made configurable with `mode`).
- [x] **Integrate `file-icons-js`:** For file type visualization in storage views and modal.
- [x] **Refine `image-storage` Tool (`ImageStorageClient`):** _(Next up for refactoring to match `FileStorageClient`)_
  - [x] Use shared `StorageControls` component.
  - [x] Integrate with enhanced `FileSelectionModal` (using `mode="addNewFiles"`, `accept="image/*"`).
  - [x] Ensure its `renderPreview` prioritizes actual image previews.
  - [x] Update "Copy" action to copy image data to clipboard.
- [ ] **Refactor other tools to use shared components:** (e.g., `Button`, `Checkbox`, `FileSelectionModal`)
  - [ ] Example: `ImageGrayScaleClient`, `ImageMontageClient`, text tools, etc.
- [ ] **Implement Inter-Tool Data Transfer ("Send To..." feature):**
  - [ ] Define `inputConfig` and refine `outputConfig` in `metadata.json` for tools.
  - [ ] Implement "Send To..." discovery UI (e.g., in `FileStorageClient`'s selection actions).
  - [ ] Implement data passing mechanism (e.g., file IDs via URL params).
  - [ ] Update target tools to accept data via this mechanism.
- [ ] **Implement Tool State Persistence:** Decide on mechanism (likely state blobs in `files` table) and implement saving/loading for tool-specific UI state. Create `ToolStateContext` or add to `FileLibraryContext`.
- [ ] **Refactor `FavoritesContext`:** Migrate from Local Storage to DB.
- [ ] **Create Site Footer:** Add links to Privacy Policy, Terms, etc.
- [ ] **Static HTML Pages:** Create and host `privacy.html`, `terms.html`. Add to `public` folder.

## AI Build Tool & Development Experience

- [ ] **Refine AI Prompts for Build Tool:** Continuously iterate based on generation quality.
- [ ] **Instruct AI to use Shared Components:** Update prompts to leverage `<Button />`, `<Checkbox />`, `FileSelectionModal`, etc.

## Bugs & Minor Fixes

- [ ] **Investigate Dexie "Invalid key provided" in `HistoryContext`'s `addHistoryEntry`**. (Currently non-blocking for core functionality).

## Completed

- [x] **Centralize Constants:** (`charset`, `history`, `text`)
- [x] **Centralize Shared Types:** (`tools`, `history`, `storage`, `build`)
- [x] **Centralize Utility Functions:** (`utils`, `colorUtils`, `isTextBasedMimeType`)
- [x] **Generate Static Metadata:** (`scripts/generate-metadata-files.mjs`)
- [x] **Implement Favorites Feature:** (Using Local Storage - _marked as done, but DB refactor is a future TODO_)
- [x] **Fix History Preview for Deleted Images:** _(Implicitly addressed by context refactors, verify)_
- [x] **Add `package.json` to Generation Context:** _(Done via project structure context script)_
