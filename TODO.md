# TODO List

## Infrastructure & Deployment

- [ ] **Configure CloudFront/API Gateway:** Set up infrastructure for dynamic API routes (build-tool, list-pending-prs, feedback, etc.). Essential for deploying full features.
- [ ] **Set up Email:** Configure an email address/contact method for the project (needed for footer, potentially feedback).

## Core Features & UX

- [ ] **Implement Inter-Tool Data Transfer:**
    - [ ] Define standard structure for tool outputs in history/metadata.
    - [ ] Add UI elements (e.g., "Send to..." button) on tool/history pages.
    - [ ] Modify tools to accept initial state via parameters.
- [ ] **Build Foundational "file-storage" Tool:**
    - [ ] Design Dexie schema for generic file storage.
    - [ ] Implement core add/get/list/delete functions.
    - [ ] Plan integration/replacement strategy for `ImageLibraryContext`.
- [ ] **Create Site Footer:**
    - [ ] Create relevant social media accounts (GitHub Org, maybe Twitter/X).
    - [ ] Design footer layout.
    - [ ] Implement footer component in `app/layout.tsx` with links.
- [ ] **Add "Pending Tools" Widget to Header:**
    - [ ] Create API endpoint (`/api/list-pending-prs`?) to fetch open PRs matching `feat/gen-*`. (Requires GitHub App/PAT).
    - [ ] Implement caching/rate limiting for the GitHub API call.
    - [ ] Create `PendingToolsWidget` React component.
    - [ ] Integrate widget into `Header` component (e.g., dropdown).
- [ ] **Add "Favorite Tool" Feature:**
    - [ ] Design UI element (e.g., star icon button) on tool pages to toggle favorite status.
    - [ ] Implement storage mechanism for favorites (likely `localStorage`, similar to history settings).
    - [ ] Create `FavoriteToolsWidget` component for homepage (similar structure to `RecentlyUsedWidget`).
    - [ ] Integrate widget onto the homepage.
- [ ] **Refine Recently Used/History Preview:** Handle deleted data gracefully (e.g., show placeholders for deleted images referenced in history).

## AI Build Tool & Development Experience

- [ ] **Refine AI Prompts for Build Tool:** Continuously iterate on prompts for `validate-directive` and `generate-tool-resources` based on observed outputs (e.g., improve handling of edge cases, dependency suggestions).
- [ ] **Implement End-to-End Testing Strategy:**
    - [ ] Decide on repository structure (monorepo `e2e/` dir recommended over separate `oet-test` repo).
    - [ ] Set up Playwright (or chosen tool) configuration.
    - [ ] *Optional:* Explore post-merge AI generation of initial test suites (requires complex GitHub Action workflow and human review).
    - [ ] Establish process for writing/updating tests for new and existing tools.
- [ ] **Define Documentation Strategy:**
    - [ ] Plan content for in-app help/tooltips.
    - [ ] Determine structure for README/CONTRIBUTING updates vs. potentially separate documentation site/wiki.

## Completed

- [x] **Centralize Constants:** Moved keys, charsets, etc., into `src/constants/`.
- [x] **Centralize Shared Types:** Consolidated interfaces (ToolMetadata, History, Build, Image) into `src/types/`.
- [x] **Centralize Utility Functions:** Moved formatters, converters, etc., into `app/lib/`.
- [x] **Generate Static Metadata:** Implemented script (`scripts/generate-metadata-files.mjs`) to create static JSON files for tools during build.
- [x] **Refactor `useImageProcessing` Hook:** (Assuming this was completed based on the previous list).