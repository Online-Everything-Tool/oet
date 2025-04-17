# TODO List

## Infrastructure & Deployment
*   [ ] **Configure CloudFront/API Gateway:** ...
*   [ ] **Set up Email:** ...

## Core Features & UX
*   [ ] **Implement Inter-Tool Data Transfer:** ...
*   [ ] **Build Foundational "file-storage" Tool:** ...
*   [ ] **Create Site Footer:** ...
*   [ ] **Add "Pending Tools" Widget to Header:** ...
*   [ ] **Add "Favorite Tool" Feature:** ... *(This is mostly done, maybe refine UI)*
*   [ ] **Refine Recently Used/History Preview:** Handle deleted data gracefully (e.g., show placeholders for deleted images referenced in history). *(This is done)*

## AI Build Tool & Development Experience
*   [ ] **Refine AI Prompts for Build Tool:**
    *   [ ] Continuously iterate on prompts for `validate-directive` and `generate-tool-resources` based on observed outputs.
    *   [x] **Update prompt to allow/suggest generation of hooks or sub-components:** Modify the `generate-tool-resources` prompt to explicitly mention that complex tools might require breaking down the client component into smaller sub-components or extracting logic into custom hooks (in an `_hooks` directory), and ask the AI to generate these additional files if deemed necessary for maintainability or complexity management, adjusting the expected JSON output structure accordingly.
*   [ ] **Implement End-to-End Testing Strategy:** ...
*   [ ] **Define Documentation Strategy:** ...

## Completed
*   [x] **Centralize Constants:** Moved keys, charsets, etc., into `src/constants/`.
*   [x] **Centralize Shared Types:** Consolidated interfaces (ToolMetadata, History, Build, Image) into `src/types/`.
*   [x] **Centralize Utility Functions:** Moved formatters, converters, etc., into `app/lib/`.
*   [x] **Generate Static Metadata:** Implemented script (`scripts/generate-metadata-files.mjs`) to create static JSON files for tools during build.
*   [x] **Refactor `ImageMontageClient`:** Broke down the component into smaller hooks (`useMontageState`, `useMontageCanvas`) and presentational components (`ImageAdjustmentCard`, `MontageControls`).
*   [x] **Implement Favorites Feature:** Added context, widgets, and buttons for favoriting tools.
*   [x] **Fix History Preview for Deleted Images:** Added check in `HistoryOutputPreview`.