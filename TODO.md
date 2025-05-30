# TODO List - OET Project

**Current Major Focus:** Enhancing AI Tool Generation pipeline, including CI/CD hardening for automated dependency management, static asset handling, and improved user experience for the Build Tool. Finalize ITDE hardening.

**Guiding Principles for ITDE (Recap):**

- Core tools persist relevant state in Dexie via `useToolState`.
- ITDE Architecture: `MetadataContext`, `useItdeDiscovery`, `useItdeTargetHandler`, `sessionStorage` signals, ITDE Modals.

---

## **NEW PRIORITY** I. Deployment, Preview Strategy & PR Status Visibility

- 🟡 **Gated Netlify Deploy Previews & Build Log Review:**
  - ⬜ CI (`validate_generated_tool_pr.yml`): Implement conditional Netlify deploy previews (e.g., via GitHub Deployments or PR labels) to trigger only after _all_ internal CI checks and _all_ AI corrective workflows pass.
  - 🟡 Review Netlify Build Logs & Function Logs Post-Launch (ongoing operational task).
- 🟡 **Enhance PR Status Reporting (`/api/pr-status` & `get_pr-ci-summary.mjs`):**
  - ⬜ Integrate details from ADM & ALF runs into the status reported by `/api/pr-status`. This might involve ADM/ALF posting a final status artifact or a small status update to a discoverable location (e.g., a check run, a specific comment tag).
  - ⬜ Align `get_pr-ci-summary.mjs` to fetch and display this enhanced status, including ADM/ALF outcomes (e.g., "ADM: Installed 2 deps", "ALF: Fixed 1 file", "ALF: No changes made, attempt already flagged").
  - 🟡 `/api/pr-status` refactor for Netlify independence & AI Fixer status integration **(Deferred from original placement, now part of this larger item)**. UI for these aspects also deferred.

## II. Inter-Tool Data Exchange (ITDE) - Finalization & Testing (Original Section I)

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

## III. Storage Component Refactoring & Deletion Logic - COMPLETE (Original Section II)

- ✅ **Generic `StorageClient.tsx`:** Created and implemented.
- ✅ **`FileStorageClient.tsx` & `ImageStorageClient.tsx`:** Refactored.
- ✅ **Deletion Logic & Thumbnailing:** Refactored.

## IV. AI-Assisted Build Tool - Architecture & Deployment (Original Section III - Prompting & Backend)

- **Prompt Construction & Context Loading (Netlify Function/Self-Hosted API):**
  - ✅ Refactor `generate-tool-resources` prompt segments into separate Markdown (`.md`) files.
  - ✅ Implement build-time bundling for `CORE_CONTEXT_FILES` into `_core_context_files.json`.
  - ✅ Implement build-time bundling for individual tool sources into `tool_contexts/_<directive>.json`.
  - ✅ `generate-tool-resources` API route now loads bundled core context and dynamically chosen bundled tool contexts.
  - ✅ Reviewed and significantly reduced `CORE_CONTEXT_FILES` for conciseness.
  - ✅ `generate-tool-resources` API output format switched to delimiter-based text. API route parses this. _(Verified assetInstructions parsing also added)_
- **Deployment of AI Backend APIs (EC2/Self-Hosted):**
  - ✅ EC2 Instance Setup and Base Next.js API Deployment (from previous)
  - ✅ SQS & GitHub Actions for Automated Updates to EC2 (from previous)
  - ✅ Client-Side Configuration (`NEXT_PUBLIC_..._API_ENDPOINT_URL`)
  - 🟡 **Thoroughly Test Full Build Tool Flow with New Endpoints** (e.g., Netlify Client -> EC2 for `/generate-tool-resources`, `/vet-dependency`, `/api/fix-linting-errors` etc.)
- **Netlify Configuration (Main Site):** (Largely done, may need tweaks for Netlify Gating later)
  - ✅ (Previous items complete)

## V. AI Asset Provisioner (AAP) - Workflow & CI Integration (Replaces "Static Asset Handling" from original Section IX)

- ⬜ **(New CI Workflow - `ai-asset-provisioner.yml` - Conceptual):**
  - ⬜ Design and implement workflow to trigger on `validate_generated_tool_pr.yml` if `assetInstructions` are present in `tool-generation-info.json`.
  - ⬜ AAP would download an `asset-instructions-${SHA}.json` artifact.
  - ⬜ AAP calls a new backend API (e.g., `/api/provision-assets`) with these instructions.
  - ⬜ The backend API uses an AI to interpret instructions, find/generate assets (placeholder for now, could be complex), or provide structured data for manual placement.
  - ⬜ AAP commits any new assets (if directly generatable/fetchable by AI) to `public/data/<directive>/` or provides clear instructions/placeholders for manual addition.
- ⬜ **(CI - `validate_generated_tool_pr.yml` - AAP Integration):**
  - ⬜ Update `analyze_state_and_dependencies` job to correctly set `action_required_for_assets: true` if `assetInstructions` are present and non-trivial (revisit the override).
  - ⬜ Upload `asset-instructions-${SHA}.json` artifact.
  - ⬜ Update PR comment logic for hand-off to AAP.
  - ⬜ Conditionally skip build jobs if AAP is expected to run first (if asset presence is critical for build).
- ⬜ **(CI - `validate_generated_tool_pr.yml` - Future Enhancement for Asset Checking):** Check for presence of required static assets in `public/data/<directive>/` based on `tool-generation-info.json` _after_ AAP has run or assets are manually added.

## VI. UI/UX Enhancements, Polish & Tool Generation Quality (Original Section IV)

- ⬜ Flicker (Scrollbar) (Low priority).
- ⬜ `linkedin-post-formatter` Paste Handling.
- ✅ **(Build Tool Prompt Refinement)** Emphasize need for `use-debounce` for sliders/frequent updates in generated tools (Added to `01_project_structure_rules.md`).

## VII. Future Tool Development & Strategic Refactors (Original Section VI)

- ⬜ **Develop "Songbook" Tool (`songbook`):**
  - ⬜ Design data structure and implement modal-based entry for lyrics/chords.
- ⬜ **(Mental Note)** Re-evaluate `/api/list-models` usage for build tool; consider "class-of-model" resolution strategy.
- ✅ **(Mental Note - API side DONE)** `/api/fix-linting-errors` API now only returns file content in `fixedFiles` if actually changed by AI (or `null` for errors).
  - 🟡 Verify ALF's `apply_fixes` step correctly iterates only over keys present in the API's `fixedFiles` response and handles `null` values gracefully (it should with the current `jq ... select(.value != null and .value != "") ...` filter).
- ✅ **(Mental Note - DONE)** `ai_lint_fixer.yml`: ALF job success/failure logic reviewed and updated to "succeed if asked to do nothing, fail if tried but made no code changes or API error."

## VIII. Deployment & Operations (Original Section VII - some items moved to new Section I)

- ✅ Netlify DNS configured for custom domain and EC2 subdomain.
- ✅ **Set up Basic Monitoring/Alerting for EC2 Instance.**
- 🟡 **Update Project Documentation (`README.md` or new `DEPLOYMENT.md`).**

## IX. Build Tool - User Experience & Workflow Enhancements (Original Section VIII - one item moved to new Section I)

- ⬜ **Validate Directive Modal - Non-Technical User Focus:** Refine overall for clarity, avoid jargon.
- ✅ **Generate Tool Resources Modal - Enhance Waiting Experience:**
  - ✅ Switched `/api/generate-modal-narrative` to delimited text format for robustness.
  - ✅ Implemented dynamic example injection for narrative variety.
  - ✅ Refined `GenerationLoadingModal.tsx` styling (size, fixed height).
- ✅ **Build Tool - `ValidateDirective` UI Enhancements:**
  - ✅ Implement URL query parameter support (`?directive=`) to pre-populate input in `BuildToolClient.tsx` and `ValidateDirective.tsx`.
  - ✅ `ValidateDirective.tsx`: Fetch `public/data/project_analysis.json` (via `BuildToolClient.tsx`) and display `suggestedNewToolDirectives` as clickable suggestions.
- ✅ **(Modified)** Create Anonymous PR Modal/Feedback:
  - ✅ `CreateAnonymousPr.tsx`: Display AI Generator message and `assetInstructions` to user.
  - ✅ `CreateAnonymousPr.tsx`: Cleaned up file preview (no longer shows virtual `tool-generation-info.json` to user).

## X. AI Tool Generation - CI/CD Hardening & Advanced Features (Original Section IX - significant progress)

- ✅ **Developer Tooling - PR Generation Script:** Create/Refine `scripts/generate-real-pr.mjs` to submit local tool code (e.g., `bitcoin-laser-eyes`) for CI/CD testing, including `tool-generation-info.json` and public assets.
- ✅ **`tool-generation-info.json` Integration (API side):**
  - ✅ `/api/create-anonymous-pr`: Now constructs and commits `app/tool/<directive>/tool-generation-info.json` containing `identifiedDependencies`, `generatorModel`, `assetInstructions`.
- ✅ **Automated Dependency Management & Vetting in CI:**
  - ✅ **(API Backend)** Implemented `/api/vet-dependency` endpoint for AI-based library assessment.
  - ✅ **(CI - `validate_generated_tool_pr.yml`)**:
    - ✅ Job to read `tool-generation-info.json`, identify new dependencies (via `analyze_state_and_dependencies` job).
    - ✅ (`/api/vet-dependency` called by ADM, not directly by VPR).
    - ✅ If new dependencies found, upload `pending-dependencies-${SHA}.json` artifact.
    - ✅ Conditionally skip build jobs if dependency manager is expected to run.
    - ✅ Update PR comment logic and workflow outcome to reflect hand-off.
  - ✅ **(New CI Workflow - `ai-dependency-manager.yml`):**
    - ✅ Drafted YAML.
    - ✅ Implemented to trigger on `validate_generated_tool_pr.yml`, download artifact, call vet API, install safe deps, commit/push, comment on PR.
- ✅ **AI Lint Fixer (`ai_lint_fixer.yml` & API):** Core logic implemented and refined. Error extraction in API and ALF's handling of API response (only processing changed files, updated success/failure logic) improved.
- ✅ **(Static Asset Handling - API side done for now)** `/api/generate-tool-resources` prompts (`01_...rules.md`, `05_...output_format.md`) updated for `ASSET_INSTRUCTIONS`.
- ✅ **(Static Asset Handling - API side done for now)** `/api/generate-tool-resources` route updated to parse `ASSET_INSTRUCTIONS`.
- ✅ **(Static Asset Handling - API side done for now)** `tool-generation-info.json` (via `/api/create-anonymous-pr`) now includes `assetInstructions`.

## XI. Tooling & Testing Enhancements (Original Section X)

- ⬜ **Douglas Ethos Checker Enhancements:**
  - ⬜ Enable Douglas to parse target tool's `metadata.json`.
  - ⬜ Implement logic for Douglas to attempt pre-populating tool state with sample data based on `inputConfig` before screenshot.
- ⬜ **Build Tool - Investigate Intermittent Suspense Hang:** Check for potential render loops in `BuildToolClient.tsx` or related hooks on page reload.

---
