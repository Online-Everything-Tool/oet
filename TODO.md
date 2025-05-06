# TODO List

**Ongoing Gemini Note (Development Philosophy):**

- **Migrations:** "Fuck it! We'll do it live!" - We are not concerned about migrating IndexedDB schemas during active development. If schema changes require it, developers (and early testers) should expect to clear their application data. Proper migration paths will be considered closer to a production release, if necessary.
- **Code Inflation & Comments:** Fully uncomment and implement any logic that was commented out during development iterations (ensure code is fully 'inflated'). Keep necessary explanatory comments _within_ the final code concise and minimal, favoring self-documenting code.
- **Fuel:** Red wine preferred.

---

## Core Features & UX

- [x] **Refactor Core Storage:** Implement two-table Dexie schema (`files`, `history`). Update types (`StoredFile`, `HistoryEntry`).
- [x] **Refactor `FileLibraryContext`:** Align with new `files` schema.
- [x] **Refactor `HistoryContext`:** Align with new `history` schema and use Dexie directly.
- [x] **Refactor `ImageLibraryContext`:** Align with new `files` schema (filter by `type`).
- [x] **Update Basic Tool Clients:** Fix `addHistoryEntry` calls (`eventTimestamp`) in `Base64EncodeDecodeClient`, `CaseConverterClient`, `ColorConverterClient`, `CryptoWalletGeneratorClient`, `EmojiExplorerClient`, `HashGeneratorClient`, `HtmlEntityExplorerClient` (implied by build fixes).
- [x] **Update Image Tool Clients:** Fix `addHistoryEntry` and `category`/`type` checks in `ImageFlipClient`, `ImageGrayScaleClient`, `ImageMontageClient`'s hooks/client.
- [x] **Update `file-storage` Tool (Client & Controls):** Remove app file logic, add selection state/handlers.
- [x] **Update `image-storage` Tool (Client):** Add selection state/handlers, align with `ImageLibraryContext`.
- [x] **Update History Page & Widgets:** Adapt `/history/page.tsx`, `RecentlyUsedWidget`, `RecentlyUsedItem` to use updated `HistoryContext` and `eventTimestamp`.
- [x] **Update Modals:** Fix `FileSelectionModal` filtering (use `type` mapping). Update `useImageProcessing` hook.
- [ ] **Refine `file-storage` UI (Selection Visuals):**
  - [ ] Implement checkbox/highlight display in `FileListView`.
  - [ ] Implement checkbox/action overlay display in `FileGridView`.
- [ ] **Implement Inter-Tool Data Transfer:** Define mechanism (URL params, context, etc.) and implement "Send To" functionality beyond zip explorer.
- [ ] **Implement Tool State Persistence:** Decide on mechanism (likely state blobs in `files` table) and implement saving/loading for tool-specific UI state. Create `ToolStateContext` or add to `FileLibraryContext`.
- [ ] **Refactor `FavoritesContext`:** Migrate from Local Storage to DB (`files` table blob or dedicated table).
- [ ] **Implement "Recently Visited" Feature:** Decide on storage (Local Storage, dedicated table) and implement logic/UI.
- [ ] **Create Site Footer:** ...

## AI Build Tool & Development Experience

- [ ] **Refine AI Prompts for Build Tool:** Continuously iterate based on generation quality.
- [ ] **Implement End-to-End Testing Strategy:** ...
- [ ] **Define Documentation Strategy:** ...

## Completed

- [x] **Centralize Constants:** (`charset`, `history`, `text`)
- [x] **Centralize Shared Types:** (`tools`, `history`, `storage`, `build`)
- [x] **Centralize Utility Functions:** (`utils`, `colorUtils`)
- [x] **Generate Static Metadata:** (`scripts/generate-metadata-files.mjs`)
- [x] **Refactor `ImageMontageClient`:** _(Implicitly updated during context refactor)_
- [x] **Implement Favorites Feature:** (Using Local Storage)
- [x] **Fix History Preview for Deleted Images:** _(Needs re-verification after HistoryContext refactor)_
- [x] **Add `package.json` to Generation Context:** ...
- [x] **Create initial `file-storage` tool:** (Basic UI and structure)
- [x] **Implement file-storage Selection Logic:** (State, controls, basic prop drilling)
