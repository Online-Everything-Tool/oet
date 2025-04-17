# TODO List

**Ongoing Gemini Note (Development Philosophy):**
*   **Migrations:** "Fuck it! We'll do it live!" - We are not concerned about migrating IndexedDB schemas during active development. If schema changes require it, developers (and early testers) should expect to clear their application data. Proper migration paths will be considered closer to a production release, if necessary.
*   **Code Inflation & Comments:** Fully uncomment and implement any logic that was commented out during development iterations (ensure code is fully 'inflated'). Keep necessary explanatory comments *within* the final code concise and minimal, favoring self-documenting code.
*   **Fuel:** Red wine preferred.

---

## Infrastructure & Deployment
*   [ ] **Configure CloudFront/API Gateway:** ...
*   [ ] **Set up Email:** ...

## Core Features & UX
*   [ ] **Implement Inter-Tool Data Transfer:** ... *(Next step after FileSelectionModal integration)*
*   [x] **Build Foundational "file-storage" Tool:** *(Basic implementation complete: CRUD, paste, drag-drop, download, conditional copy, send-to placeholder)*
*   [ ] **Create Site Footer:** ...
*   [ ] **Add "Pending Tools" Widget to Header:** ...
*   [x] **Add "Favorite Tool" Feature:** ...
*   [x] **Refine Recently Used/History Preview:** Handle deleted images.
*   [ ] **Refactor `ImageSelectionModal` into Generic `FileSelectionModal`:** *(In Progress)*
    *   [ ] **Create Generic `FileSelectionModal.tsx`:** *(Next Step)*
        *   [ ] Define configurable props: `isOpen`, `onClose`, `onFileSelected`, `accept` (for upload input), `libraryFilter` (e.g., `{ category: 'archive' }`).
        *   [ ] Implement UI with "Upload New" and "Select from Library" tabs.
        *   [ ] Use `useFileLibrary` to list files in the "Library" tab based on `libraryFilter`.
        *   [ ] Add file input (`<input type="file">`) using the `accept` prop.
        *   [ ] Add drag-and-drop and paste support to the "Upload New" area.
        *   [ ] Add an optional "Add to Library after selecting?" checkbox for new uploads.
        *   [ ] Implement the `onFileSelected(blob, name, source, savePreference, fileId?)` callback logic.
    *   [ ] Move image adding logic (upload button, paste handler, drag-and-drop) from `image-storage` tool (or implement if not existing) into `FileSelectionModal`. *(Addressed by creating the generic modal first)*
    *   [ ] Use `useFileLibrary().addFile` within the modal *if* the "Save to Library" option is chosen *during upload*. *(Decision: Callback approach preferred - modal returns preference, caller saves)*. Let's stick to the plan: Modal calls `onFileSelected` with selection details including save preference, the *calling tool* handles the actual saving via context.
    *   [ ] Ensure the image list within the modal refreshes after adding new images. *(Covered by `useFileLibrary` state)*
    *   [ ] Update tools using the modal (e.g., `image-gray-scale`, `zip-file-explorer`) to use the enhanced `FileSelectionModal`.
    *   [ ] Simplify or refactor the `image-storage` tool's primary view, potentially removing redundant upload UI if the modal becomes the main input method.

## AI Build Tool & Development Experience
*   [ ] **Refine AI Prompts for Build Tool:**
    *   [ ] Continuously iterate on prompts for `validate-directive` and `generate-tool-resources`.
    *   [x] **Update prompt to allow/suggest generation of hooks or sub-components.**
*   [ ] **Implement End-to-End Testing Strategy:** ...
*   [ ] **Define Documentation Strategy:** ...

## Completed
*   [x] **Centralize Constants:** ...
*   [x] **Centralize Shared Types:** ... (`StoredFile`, moved `LibraryImage`)
*   [x] **Centralize Utility Functions:** ...
*   [x] **Generate Static Metadata:** ...
*   [x] **Refactor `ImageMontageClient`:** ...
*   [x] **Implement Favorites Feature:** ...
*   [x] **Fix History Preview for Deleted Images:** ...
*   [x] **Add `package.json` to Generation Context:** ...
*   [x] **Refactor `ImageLibraryContext`:** Uses `StoredFile` and `files` table.
*   [x] **Create `FileLibraryContext`:** Generic context for `files` table.
*   [x] **Update Dexie Schema:** Added `files` table, incremented version.
*   [x] **Update components using `ImageLibraryContext`:** (`HistoryOutputPreview`, `ImageSelectionModal`, `ImageStorageClient`)
*   [x] **Create initial `file-storage` tool:** (`metadata.json`, `page.tsx`, `FileStorageClient.tsx` with basic CRUD, paste, drag-drop, download, conditional copy).