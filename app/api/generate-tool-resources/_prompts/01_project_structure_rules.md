**Project Structure & Rules:**

1.  **Client-Side Focus:** Core tool logic MUST execute entirely in the user's browser. No backend needed for the main functionality unless explicitly stated.
2.  **Core File Structure:** Each tool lives in `app/tool/<directive>/` and typically requires THREE core files:
    - `app/tool/<directive>/page.tsx`: Standard React Server Component wrapper. Imports metadata, ToolHeader, ToolSuspenseWrapper, and the main client component. Renders these, passing necessary props. Follow patterns from examples.
    - `app/tool/<directive>/_components/<ComponentName>Client.tsx`: Main Client Component named `<ComponentName>Client.tsx`. Contains core state (useState), logic (handlers, effects), and UI (HTML).
    - `app/tool/<directive>/metadata.json`: Contains tool metadata (title, description, inputConfig, outputConfig etc.). Use the 'ToolMetadata' type definition from `src/types/tools.ts`.
3.  **Decomposition:** For tools with significant complexity (many states, complex UI sections, intricate logic), DO NOT put everything into the main Client Component. Instead, decompose by generating additional helper files:
    - **Custom Hooks:** For tool-specific complex state logic, side effects, or reusable calculations, create custom hooks in `app/tool/<directive>/_hooks/<hookName>.ts`.
    - **Sub-Components:** For complex UI sections, break them into smaller, focused presentational components in `app/tool/<directive>/_components/<SubComponentName>.tsx`.
4.  **Libraries:** 
    - Leverage existing project dependencies listed in `package.json` (like `uuid`, `date-fns`, `use-debounce`, `swipper`, etc.) when their functionality is applicable.  
    - **Critical** If an external npm library is to be utilized it **must** be identify it in the `---START_DEPS---` block.
    - **Critical** Associated @types libraries for external dependencies **must** be included in the `---START_DEPS---` block.
5.  **UI:**
    - Use standard HTML elements and where possible use components from `app/tool/_components/form` and from `app/tool/_components/shared`. Use CSS using the project's CSS variables from `app/globals.css` (e.g., `rgb(var(--color-text-base))`). Keep UI clean and functional.
    - For components or input fields that trigger frequent updates or re-computations (e.g., live text input processing, range sliders), you should use the `use-debounce` hook (e.g., from the `use-debounce` npm package).
6.  **State Management:**
    - Primary tool state (inputs, outputs that need to persist, user settings for the tool) MUST use the `useToolState` hook for persistence in Dexie. Structure the state object logically.
    - Simple state that represents a meaningful input, configuration, or result that could be shared between users via a URL link can use the `useToolUrlState` hook. Define corresponding `urlStateParams` in `metadata.json` for such cases. For most other internal tool state and primary input/output references, prefer `useToolState`.
    - Standard React hooks (useState, useCallback, useEffect, etc.) should be used for local component state.
7.  **Inter-Tool Data Exchange (ITDE):** New tools should be designed to participate in ITDE where applicable.
    - **Metadata Configuration:** The `metadata.json` file MUST accurately define its `inputConfig` (array) and `outputConfig` (object). Refer to `src/types/tools.ts`. This is vital for discovery.
      - `inputConfig` should list MIME types the tool can receive (e.g., "image/*", "text/plain", "application/json"). \*\*Even if the primary UI uses textareas for input (like for JSON or text), if the tool *can* conceptually accept these MIME types via ITDE, list them.\*\* For tools that *only\* generate output and take no input (e.g., a password generator), use an empty array `[]`.
      - `stateFiles` within `inputConfig` should be "none" if the tool does not load file references from its own state for input, otherwise specify the state keys.
      - `outputConfig` should describe the `dataType` (e.g., "reference", "inline", "none"), any relevant state keys from the tool's `useToolState` (like `processedFileId` or `outputValue`) for accessing the output.
    - **Sending Data:** If the tool produces shareable output, its Client Component should implement UI elements (e.g., a "Send" button) that allow users to select a compatible target tool. This involves using discovery mechanisms (see `useItdeDiscovery` hook pattern in examples) and signaling the target tool (see `itdeSignalStorageUtils.ts` patterns in examples).
    - **Receiving Data:** If the tool accepts data via ITDE, its Client Component should:
      - Employ a handler (see `useItdeTargetHandler` hook pattern in examples) to detect incoming signals.
      - Provide a UI mechanism (e.g., a modal) for the user to accept or ignore incoming data.
      - When data is accepted (e.g., in an `onProcessSignal` callback), the tool must fetch the data from the source tool. This involves:
        1.  Consulting the source tool's `outputConfig` (via `MetadataContext`).
        2.  Retrieving the source tool's persisted state (from Dexie, likely using `FileLibraryContext` to get the state file by the source's state ID: `state-<sourceDirective>`).
        3.  Extracting the specific output data (e.g., a `processedFileId` or `outputValue` value) from that source state.
        4.  Setting the current tool's own input state (e.g., using its `setToolState` to update the `inputConfig` fields with the received data, and then triggering its own processing logic if appropriate.
8.  **Shared Components & Hooks:** Utilize the provided shared components (e.g., `Button`, `Input`, `FileSelectionModal`) and hooks (e.g., `useImageProcessing`, `useFileLibrary`) from the Core Project Definitions where appropriate. Study their usage in the examples.
9.  **Static Assets, Local Data Paths, and Asset Declaration:**
    - **Core Offline Principle:** The fundamental logic of any tool you generate must operate entirely client-side after initial page load, without making external network calls to third-party APIs or CDNs for dynamic data, scripts, or telemetry.
    - **Permitted Use of Local Static Assets:**
      - Some tools may require static assets that are not part of the generated code itself. Examples include pre-trained machine learning models, large JSON data files for lookups, SVG files for complex iconography, or other binary assets.
      - For the purpose of your code generation, you can **presume such necessary static assets will be made available locally within the project.**
      - Your generated client-side code (`<ComponentName>Client.tsx` or custom hooks) should be written to **fetch and/or otherwise utilize these assets ONLY from relative paths starting with `/data/{{TOOL_DIRECTIVE}}/`** (e.g., `/data/{{TOOL_DIRECTIVE}}/models/model.weights`, `/data/{{TOOL_DIRECTIVE}}/datasets/dataset.json`).
    - **Mandatory Asset Declaration (`---START_ASSET_INSTRUCTIONS---`):**
      - If your generated tool's code relies on any such locally-hosted static assets (as described above), you **MUST declare these requirements** in the `---START_ASSET_INSTRUCTIONS---` block of your output.
      - Asset declarations will be used by an automated "Staff Engineer AI" to ensure the necessary assets are correctly provisioned and placed into the `public/data/{{TOOL_DIRECTIVE}}/` directory structure.