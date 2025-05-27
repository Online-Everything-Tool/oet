# TODO List - OET Project

**Current Major Focus:** Enhancing AI Tool Generation pipeline, including CI/CD hardening for automated dependency management, static asset handling, and improved user experience for the Build Tool. Finalize ITDE hardening.

**Guiding Principles for ITDE (Recap):**

- Core tools persist relevant state in Dexie via `useToolState`.
- ITDE Architecture: `MetadataContext`, `useItdeDiscovery`, `useItdeTargetHandler`, `sessionStorage` signals, ITDE Modals.

---

## I. Inter-Tool Data Exchange (ITDE) - Finalization & Testing

- **Phase 1 & 2: Core Infrastructure & Accept/Defer Logic - LARGELY COMPLETE**
  - ✅ `MetadataContext.tsx`: Implemented.
  - ✅ `sessionStorageUtils.ts`: Implemented.
  - ✅ `useItdeDiscovery.ts`: Implemented and **REFINED**.
  - ✅ `SendToToolButton.tsx` / `OutputActionButtons.tsx`: Implemented and **REFINED**.
  - ✅ `useItdeTargetHandler.ts`: Implemented.
  - ✅ `IncomingDataModal.tsx`: Implemented.
  - ✅ `ItdeAcceptChoiceModal.tsx`: Implemented.
- **Tool-Specific ITDE Integration - MOSTLY COMPLETE / ONGOING REVIEW**
  - ✅ (All listed tools have their ITDE integration marked as complete from previous versions)
- **Phase 3: Cleanup & Refinements - ONGOING**
  - ✅ Temporary ITDE File Cleanup: `cleanupOrphanedTemporaryFiles` logic refined.
  - 🟡 **Review All Tools' `handleProcessIncomingSignal` (General Hardening):** Systematically verify each ITDE-receiving tool correctly validates incoming data and clears signals. (High Priority)
  - 🟡 **Thorough End-to-End ITDE Testing:** Test various send/receive combinations between all ITDE-enabled tools.
  - 🟡 UI/UX Polish for "Send To..." and "Incoming Data" experiences.

## II. Storage Component Refactoring & Deletion Logic - COMPLETE

- ✅ **Generic `StorageClient.tsx`:** Created and implemented.
- ✅ **`FileStorageClient.tsx` & `ImageStorageClient.tsx`:** Refactored.
- ✅ **Deletion Logic & Thumbnailing:** Refactored.

## III. AI-Assisted Build Tool - Architecture & Deployment

- **Prompt Construction & Context Loading (Netlify Function/Self-Hosted API):**
  - ✅ Refactor `generate-tool-resources` prompt segments into separate Markdown (`.md`) files.
  - ✅ Implement build-time bundling for `CORE_CONTEXT_FILES` into `_core_context_files.json`.
  - ✅ Implement build-time bundling for individual tool sources into `tool_contexts/_<directive>.json`.
  - ✅ `generate-tool-resources` API route now loads bundled core context and dynamically chosen bundled tool contexts.
  - ✅ Reviewed and significantly reduced `CORE_CONTEXT_FILES` for conciseness.
  - ✅ `generate-tool-resources` API output format switched to delimiter-based text. API route parses this. _(Verified assetInstructions parsing also added)_
- **Deployment of AI Backend APIs (EC2/Self-Hosted):** _(Assuming `/api/generate-tool-resources` and new `/api/vet-dependency` are or will be part of this)_
  - ✅ EC2 Instance Setup and Base Next.js API Deployment (from previous)
  - ✅ SQS & GitHub Actions for Automated Updates to EC2 (from previous)
  - ✅ Client-Side Configuration (`NEXT_PUBLIC_..._API_ENDPOINT_URL`)
  - 🟡 **Thoroughly Test Full Build Tool Flow with New Endpoints** (e.g., Netlify Client -> EC2 for `/generate-tool-resources`, `/vet-dependency`, etc.)
- **Netlify Configuration (Main Site):** (Largely done, may need tweaks for Netlify Gating later)
  - ✅ (Previous items complete)

## IV. UI/UX Enhancements, Polish & Tool Generation Quality

- ⬜ Flicker (Scrollbar) (Low priority).
- ⬜ `linkedin-post-formatter` Paste Handling.
- ✅ **(Build Tool Prompt Refinement)** Emphasize need for `use-debounce` for sliders/frequent updates in generated tools (Added to `01_project_structure_rules.md`).

## VI. Future Tool Development & Strategic Refactors

- ⬜ **Develop "Songbook" Tool (`songbook`):**
  - ⬜ Design data structure and implement modal-based entry for lyrics/chords.
- ⬜ **(Mental Note from previous discussion)** Re-evaluate `/api/list-models` usage for build tool; consider "class-of-model" resolution strategy.

## VII. Deployment & Operations

- ✅ Netlify DNS configured for custom domain and EC2 subdomain.
- 🟡 **Review Netlify Build Logs & Function Logs Post-Launch.**
- ✅ **Set up Basic Monitoring/Alerting for EC2 Instance.**
- 🟡 **Update Project Documentation (`README.md` or new `DEPLOYMENT.md`).**
- ✅ **GitHub Actions CI/CD Implemented:** (Base workflows exist). _(Hardening in new section IX)_

## VIII. Build Tool - User Experience & Workflow Enhancements

- ⬜ **Validate Directive Modal - Non-Technical User Focus:** Refine overall for clarity, avoid jargon.
- ✅ **Generate Tool Resources Modal - Enhance Waiting Experience:**
  - ✅ Switched `/api/generate-modal-narrative` to delimited text format for robustness.
  - ✅ Implemented dynamic example injection for narrative variety.
  - ✅ Refined `GenerationLoadingModal.tsx` styling (size, fixed height).
- 🟡 **(Modified)** Create Anonymous PR Modal/Feedback:
  - ✅ `CreateAnonymousPr.tsx`: Display AI Generator message and `assetInstructions` to user.
  - ✅ `CreateAnonymousPr.tsx`: Cleaned up file preview (no longer shows virtual `tool-generation-info.json` to user).
  - 🟡 `/api/pr-status` refactor for Netlify independence & AI Fixer status integration **(Deferred)**. UI for these aspects also deferred.
- ✅ **Build Tool - `ValidateDirective` UI Enhancements:**
  - ✅ Implement URL query parameter support (`?directive=`) to pre-populate input in `BuildToolClient.tsx` and `ValidateDirective.tsx`.
  - ✅ `ValidateDirective.tsx`: Fetch `public/data/project_analysis.json` (via `BuildToolClient.tsx`) and display `suggestedNewToolDirectives` as clickable suggestions.

## IX. AI Tool Generation - CI/CD Hardening & Advanced Features (NEW SECTION - High Priority)

- ⬜ **Developer Tooling - PR Generation Script:**
  - ⬜ Create/Refine `scripts/generate-real-pr.mjs` to submit local tool code (e.g., `bitcoin-laser-eyes`) for CI/CD testing, including `tool-generation-info.json` and public assets.
- ✅ **`tool-generation-info.json` Integration (API side):**
  - ✅ `/api/create-anonymous-pr`: Now constructs and commits `app/tool/<directive>/tool-generation-info.json` containing `identifiedDependencies`, `generatorModel`, `assetInstructions`.
- ⬜ **Automated Dependency Management & Vetting in CI:**
  - ✅ **(API Backend)** Implemented `/api/vet-dependency` endpoint for AI-based library assessment.
  - ⬜ **(CI - `validate_generated_tool_pr.yml`)**:
    - ⬜ Job to read `tool-generation-info.json`, identify new dependencies.
    - ⬜ Call `/api/vet-dependency` for new packages.
    - ⬜ If new dependencies found, upload `pending-dependencies-${SHA}.json` artifact.
    - ⬜ Conditionally skip build jobs if dependency manager is expected to run.
    - ⬜ Update PR comment logic and workflow outcome to reflect hand-off.
  - ⬜ **(New CI Workflow - `ai-dependency-manager.yml`):**
    - ✅ Drafted YAML.
    - ⬜ Implement to trigger on `validate_generated_tool_pr.yml`, download artifact, call vet API, install safe deps, commit/push, comment/label PR.
- ⬜ **Gated Netlify Deploy Previews:**
  - ⬜ CI (`validate_generated_tool_pr.yml`): Implement conditional Netlify deploy previews (e.g., via GitHub Deployments or PR labels) to trigger only after _all_ internal CI checks and _all_ AI corrective workflows pass.
- ⬜ **Static Asset Handling for AI-Generated Tools:**
  - ✅ `/api/generate-tool-resources` prompts (`01_...rules.md`, `05_...output_format.md`) updated for `ASSET_INSTRUCTIONS`.
  - ✅ `/api/generate-tool-resources` route updated to parse `ASSET_INSTRUCTIONS`.
  - ✅ `tool-generation-info.json` (via `/api/create-anonymous-pr`) now includes `assetInstructions`.
  - ⬜ **(CI - `validate_generated_tool_pr.yml` - Future Enhancement)** Check for presence of required static assets in `public/data/<directive>/` based on `tool-generation-info.json` or `assetInstructions`.

## X. Tooling & Testing Enhancements (NEW SECTION)

- ⬜ **Douglas Ethos Checker Enhancements:**
  - ⬜ Enable Douglas to parse target tool's `metadata.json`.
  - ⬜ Implement logic for Douglas to attempt pre-populating tool state with sample data based on `inputConfig` before screenshot.
- ⬜ **Build Tool - Investigate Intermittent Suspense Hang:** (Mental note from dev experience) Check for potential render loops in `BuildToolClient.tsx` or related hooks on page reload.
