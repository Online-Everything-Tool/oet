# TODO List - OET Project

**Current Status:** Significant progress has been made on core UI/UX and foundational code health. The massive color system refactor is complete, providing a solid, maintainable base. The introductory user experience is now a polished, standout feature.

**Next Major Focus:** The primary objective now shifts back to the AI tool generation pipeline. Hardening the CI/CD workflows for dependency management, asset provisioning, and status visibility is the most critical next step to making the Build Tool reliable and truly useful.

---

## **I. Build Pipeline & CI/CD (Highest Priority)**

- ✅ **Gated Netlify Deploy Previews & Build Log Review:**
  - ✅ **CI (`validate_generated_tool_pr.yml`):** Implement conditional Netlify deploy previews (e.g., via GitHub Deployments or PR labels) to trigger only after _all_ internal CI checks and _all_ AI corrective workflows pass.
  - ✅ Review Netlify Build Logs & Function Logs Post-Launch (ongoing operational task).
- ✅ **Enhance PR Status Reporting (`/api/status-pr` & `get_pr-ci-summary.mjs`):**
  - ✅ Integrate details from the Automated Dependency Manager (ADM) & AI Lint Fixer (ALF) runs into the status reported by `/api/status-pr`. This requires the CI workflows to output a final status artifact or update a check run.
  - ✅ Align `get_pr-ci-summary.mjs` to fetch and display this enhanced status, including outcomes like "ADM: Installed 2 deps" or "ALF: No changes made".
- ⬜ **AI Asset Provisioner (AAP) - Workflow & CI Integration:**
  - ⬜ **(New CI Workflow):** Design and implement a workflow to trigger if `assetInstructions` are present in `tool-generation-info.json`. This workflow will call a new backend API (`/api/provision-assets`) to interpret instructions and commit generated assets (or placeholders) to the PR.
  - ⬜ **(CI - `validate_generated_tool_pr.yml`):** Update logic to correctly handle hand-off to the AAP workflow.

## **II. Core Application & UX**

- ✅ **Finalize ITDE Hardening & Testing:**
  - ✅ **Review All Tools' `handleProcessIncomingSignal`:** Systematically verify each ITDE-receiving tool correctly validates incoming data, handles it, and properly clears the signal.
  - ⬜ **Thorough End-to-End ITDE Testing:** Test various send/receive combinations between all ITDE-enabled tools to catch edge cases.
- ✅ **Build Tool - User Experience:**
  - ✅ Refine the "Validate Directive" modal for non-technical users, avoiding jargon.
- ⬜ **General UI Polish:**
  - ⬜ Investigate and fix the minor scrollbar flicker on page load. (Low priority).
  - ⬜ Improve paste handling in the `linkedin-post-formatter`.

## **III. Future Development & Enhancements**

- ✅ **Develop "Songbook" Tool (`songbook`):**
  - ✅ Design data structure and implement modal-based entry for lyrics/chords.
- ✅ **Enhance `Douglas Ethos Checker` (Testing Tool):**
  - ⬜ Enable Douglas to parse a target tool's `metadata.json`.
  - ⬜ Implement logic for Douglas to attempt pre-populating a tool's state with sample data based on its `inputConfig` before taking a screenshot.
- ✅ **Build Tool - Investigate Intermittent Suspense Hang:** Check for potential render loops in `BuildToolClient.tsx` or related hooks on page reload.

---

## **✅ Completed Milestones**

- ✅ **Massive UI/Color System Refactor:**
  - ✅ Implemented a semantic, CSS variable-driven color system in `globals.css`.
  - ✅ Purged all hardcoded Tailwind color classes (`bg-blue-500`, `text-gray-700`, etc.) and arbitrary hex values from all `.tsx` components.
  - ✅ Removed all unused `dark:` mode utility classes, unifying the codebase to a single, consistent light theme.
- ✅ **Introductory Story Modal Polish:**
  - ✅ Refined the narrative for better storytelling and consistent length.
  - ✅ Implemented staggered, `framer-motion`-powered animations for a fluid, professional user experience.
  - ✅ Re-engineered Swiper navigation with external, state-aware controls to prevent UI overlap and improve usability.
- ✅ **Generic Storage Component:**
  - ✅ Created and implemented the generic `StorageClient.tsx` to handle all file/image library views.
  - ✅ Refactored `FileStorageClient` and `ImageStorageClient` to use the new generic component.
- ✅ **AI Tooling Backend & CI Foundation:**
  - ✅ Implemented backend APIs (`/generate-tool-resources`, `/vet-dependency`, `/fix-linting-errors`) with context bundling.
  - ✅ Created CI workflows for the Automated Dependency Manager (`ai_dependency_manager.yml`) and AI Lint Fixer (`ai_lint_fixer.yml`).
  - ✅ Established the `tool-generation-info.json` standard for passing metadata from generation to CI.
- ✅ **Inter-Tool Data Exchange (ITDE) - Core Infrastructure:**
  - ✅ Implemented `MetadataContext`, `sessionStorageUtils`, `useItdeDiscovery`, `useItdeTargetHandler`, and all related modals (`IncomingDataModal`, `ItdeAcceptChoiceModal`).
