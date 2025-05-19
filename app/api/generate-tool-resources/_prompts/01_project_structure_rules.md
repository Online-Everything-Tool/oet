**Project Structure & Rules:**

1.  **Client-Side Focus:** Core tool logic MUST execute entirely in the user's browser. No backend needed for the main functionality unless explicitly stated otherwise (rare).
2.  **Core File Structure:** Each tool lives in `app/tool/<directive>/` and typically requires THREE core files:
    - `app/tool/<directive>/page.tsx`: Standard React Server Component wrapper. Imports metadata, ToolHeader, ToolSuspenseWrapper, and the main client component. Renders these, passing necessary props. Follow patterns from examples.
    - `app/tool/<directive>/_components/<ComponentName>Client.tsx`: Main Client Component named `<ComponentName>Client.tsx`. Contains core state (useState), logic (handlers, effects), and UI (HTML).
    - `app/tool/<directive>/metadata.json`: Contains tool metadata (title, description, inputConfig, outputConfig etc.). Use the 'ToolMetadata' type definition from `src/types/tools.ts`.
3.  **Decomposition (IMPORTANT):** For tools with significant complexity (many states, complex UI sections, intricate logic), DO NOT put everything into the main Client Component. Instead, decompose by generating additional helper files:
    - **Custom Hooks:** For tool-specific complex state logic, side effects, or reusable calculations, create custom hooks in `app/tool/<directive>/_hooks/<hookName>.ts`.
    - **Sub-Components:** For complex UI sections, break them into smaller, focused presentational components in `app/tool/<directive>/_components/<SubComponentName>.tsx`.
4.  **UI:** Use standard HTML elements and where possible used components from `app/tool/_components/form` using CSS using project's CSS variables from `app/globals.css` (e.g., `rgb(var(--color-text-base))`). Keep UI clean and functional.
5.  **State Management:**
    - Primary tool state (inputs, outputs that need to persist, user settings for the tool) MUST use the `useToolState` hook for persistence in Dexie. Structure the state object logically.
    - Simple state that represents a meaningful input, configuration, or result that could be shared between users via a URL link can use the `useToolUrlState` hook. Define corresponding `urlStateParams` in `metadata.json` for such cases. For most other internal tool state and primary input/output references, prefer `useToolState`.
    - Standard React hooks (useState, useCallback, useEffect, etc.) should be used for local component state.
6.  **Inter-Tool Data Exchange (ITDE):** New tools should be designed to participate in ITDE where applicable.
    - **Metadata Configuration:** The `metadata.json` file MUST accurately define its `inputConfig` (array) and `outputConfig` (object). Refer to `src/types/tools.ts`. This is vital for discovery.
      - `inputConfig` should list MIME types the tool can receive (e.g., "image/*", "text/plain", "application/json"). \*\*Even if the primary UI uses textareas for input (like for JSON or text), if the tool *can* conceptually accept these MIME types via ITDE, list them.\*\* For tools that *only\* generate output and take no input (e.g., a password generator), use an empty array `[]`.
      - `stateFiles` within `inputConfig` should be "none" if the tool does not load file references from its own state for input, otherwise specify the state keys.
      - `outputConfig` should describe the `dataType` (e.g., "reference", "inline", "none"), any relevant state keys from the tool's `useToolState` (like `processedFileId` or `outputValue`) for accessing the output.
    - **Sending Data:** If the tool produces shareable output, its Client Component should implement UI elements (e.g., a "Send To..." button) that allow users to select a compatible target tool. This involves using discovery mechanisms (see `useItdeDiscovery` hook pattern in examples) and signaling the target tool (see `itdeSignalStorageUtils.ts` patterns in examples).
    - **Receiving Data:** If the tool accepts data via ITDE, its Client Component should:
      - Employ a handler (see `useItdeTargetHandler` hook pattern in examples) to detect incoming signals.
      - Provide a UI mechanism (e.g., a modal) for the user to accept or ignore incoming data.
      - When data is accepted (e.g., in an `onProcessSignal` callback), the tool must fetch the data from the source tool. This involves:
        1.  Consulting the source tool's `outputConfig` (via `MetadataContext`).
        2.  Retrieving the source tool's persisted state (from Dexie, likely using `FileLibraryContext` to get the state file by the source's state ID: `state-<sourceDirective>`).
        3.  Extracting the specific output data (e.g., a `processedFileId` or `outputValue` value) from that source state.
        4.  Setting the current tool's own input state (e.g., using its `setToolState` to update a `selectedFileId` or input text fields) with the received data, and then triggering its own processing logic if appropriate.
7.  **Shared Components & Hooks:** Utilize the provided shared components (e.g., `Button`, `Input`, `FileSelectionModal`) and hooks (e.g., `useImageProcessing`, `useFileLibrary`) from the Core Project Definitions where appropriate. Study their usage in the examples.
