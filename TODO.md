# TODO List - OET Project

**Current Major Focus:** Complete and stabilize the EC2 + SQS setup for the AI tool generation backend. Thoroughly test the AI Build Tool end-to-end with the new hybrid architecture. Finalize ITDE hardening.

**Guiding Principles for ITDE (Recap):**
- Core tools persist relevant state in Dexie via `useToolState`.
- ITDE Architecture: `MetadataContext`, `useItdeDiscovery`, `useItdeTargetHandler`, `sessionStorage` signals, ITDE Modals.

---

## I. Inter-Tool Data Exchange (ITDE) - Finalization & Testing
- **Phase 1 & 2: Core Infrastructure & Accept/Defer Logic - LARGELY COMPLETE**
  - [x] `MetadataContext.tsx`: Implemented.
  - [x] `sessionStorageUtils.ts`: Implemented.
  - [x] `useItdeDiscovery.ts`: Implemented and **REFINED**.
  - [x] `SendToToolButton.tsx` / `OutputActionButtons.tsx`: Implemented and **REFINED**.
  - [x] `useItdeTargetHandler.ts`: Implemented.
  - [x] `IncomingDataModal.tsx`: Implemented.
  - [x] `ItdeAcceptChoiceModal.tsx`: Implemented.
- **Tool-Specific ITDE Integration - MOSTLY COMPLETE / ONGOING REVIEW**
  - [x] `image-flip`: ITDE Send/Receive implemented.
  - [x] `image-gray-scale`: ITDE Send/Receive implemented (with `OutputActionButtons` & `FilenamePromptModal`).
  - [x] `image-montage`: ITDE Send implemented. Receive logic fixed.
  - [x] `base64-encode-decode`: ITDE Send/Receive implemented.
  - [x] `case-converter`: ITDE Send/Receive implemented.
  - [x] `hash-generator`: ITDE Send/Receive implemented.
  - [x] `json-validate-format`: ITDE Send/Receive implemented.
  - [x] `text-reverse`: ITDE Send/Receive implemented.
  - [x] `text-strike-through`: ITDE Receive implemented.
  - [x] `file-storage`: ITDE Send implemented.
  - [x] `image-storage`: ITDE Send implemented.
  - [x] `zip-file-explorer`: ITDE Send/Receive implemented and refined.
- **Phase 3: Cleanup & Refinements - ONGOING**
  - [x] Temporary ITDE File Cleanup: `cleanupOrphanedTemporaryFiles` logic refined.
  - [x] **Review All Tools' `handleProcessIncomingSignal` (General Hardening):** Systematically verify each ITDE-receiving tool correctly validates incoming data and clears signals. (High Priority)
  - [x] **Thorough End-to-End ITDE Testing:** Test various send/receive combinations between all ITDE-enabled tools.
  - [x] UI/UX Polish for "Send To..." and "Incoming Data" experiences.

## II. Storage Component Refactoring & Deletion Logic - COMPLETE
- [x] **Generic `StorageClient.tsx`:** Created and implemented.
- [x] **`FileStorageClient.tsx` & `ImageStorageClient.tsx`:** Refactored.
- [x] **Deletion Logic & Thumbnailing:** Refactored.

## III. AI-Assisted Build Tool - Architecture & Deployment
- **Prompt Construction & Context Loading (Netlify Function/Self-Hosted API):**
  - [x] Refactor `generate-tool-resources` prompt segments into separate Markdown (`.md`) files.
  - [x] Implement build-time bundling for `CORE_CONTEXT_FILES` into `_core_context_files.json`.
  - [x] Implement build-time bundling for individual tool sources into `tool_contexts/_<directive>.json`.
  - [x] `generate-tool-resources` API route now loads bundled core context and dynamically chosen bundled tool contexts.
  - [x] Reviewed and significantly reduced `CORE_CONTEXT_FILES` for conciseness.
  - [x] `generate-tool-resources` API output format switched to delimiter-based text to avoid JSON escaping issues with code. API route parses this.
- **Deployment of `/api/generate-tool-resources` to External Server (AWS EC2):**
  - [x] **EC2 Instance Setup (`t2.micro` or `t3.small`):**
    - [x] Instance launched, IP provisioned.
    - [x] Install Node.js (via NVM), Git.
    - [x] Deploy Next.js app (to serve the API endpoint and access bundled contexts).
    - [x] Set up Caddy (or Nginx) for reverse proxy and HTTPS for the custom subdomain (e.g., `oet.online-everything-tool.com`).
    - [x] Configure environment variables on EC2 (`GEMINI_API_KEY`, `PORT`, etc.).
    - [x] Ensure Next.js API route sets correct CORS headers for `online-everything-tool.com`.
    - [x] Set up PM2 (or systemd) to run the Next.js app (or minimal Node server).
  - [x] **SQS & GitHub Actions for Automated Updates to EC2:**
    - [x] SQS Queue created.
    - [x] IAM Roles/Users configured (for GitHub Actions to send to SQS, for EC2 to read from SQS).
    - [x] Finalize and test GitHub Action workflow (`notify_ec2_on_push.yml`) to send SQS message on `main` branch push.
    - [x] Implement and test SQS polling script (`check_sqs_and_delete.sh` via cron) on EC2.
    - [x] Implement and test update script (`incoming_sqs_update.sh` in repo) called by poller to handle `git pull`, `npm ci`, `npm run build` (for contexts), and `pm2 restart`.
  - [x] **Client-Side Configuration:**
    - [x] `NEXT_PUBLIC_GENERATE_API_ENDPOINT_URL` environment variable configured for Netlify frontend and local `.env`.
    - [x] `GenerateToolResources.tsx` uses this environment variable (with fallback for local dev).
    - [x] Loading modal implemented in `GenerateToolResources.tsx`.
  - [ ] **Thoroughly Test Full Build Tool Flow on Production Environment (Netlify Client -> EC2 API).**
- **Netlify Configuration (Main Site):**
  - [x] `next.config.js` updated: `trailingSlash: false`, `serverExternalPackages` (for remaining Netlify functions if any, e.g., PR creation).
  - [x] Removed `netlify.toml` SPA redirect (as Next.js plugin handles routing).
  - [x] `/api/generate-tool-resources` path on Netlify should no longer resolve to a Netlify function (client calls EC2 directly).

## IV. UI/UX Enhancements & Polish - MEDIUM PRIORITY
- [ ] Flicker (Scrollbar) (Low priority).
- [ ] `linkedin-post-formatter` Paste Handling.

## VI. Future Tool Development & Strategic Refactors - HIGH PRIORITY
- [ ] (Build Tool Future) Expand on the generate-tool-resource modal
- [ ] (Build Tool Future) Explore getting netlify Deploy Preview back to the user 

## VII. Deployment & Operations (New Section)
  - [x] Netlify DNS configured for custom domain and EC2 subdomain.
  - [x] **Review Netlify Build Logs & Function Logs Post-Launch:** Monitor errors, performance (for remaining Netlify functions like PR creation, list-models, validate-directive).
  - [x] **Set up Basic Monitoring/Alerting for EC2 Instance:** CloudWatch alarms (CPU, Status Checks).
  - [x] **Update Project Documentation (`README.md` or new `DEPLOYMENT.md`):** Detail hybrid Netlify + EC2 architecture and update process.