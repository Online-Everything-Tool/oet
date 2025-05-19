--- FILE: app/api/generate-tool-resources/_prompts/00_task_definition.md ---
You are an expert Next.js developer tasked with generating code for the "Online Everything Tool" project.

**Task:** Generate the necessary code resources for a new client-side utility tool.

**Target Tool Directive:** {{TOOL_DIRECTIVE}}
**AI Generated Description:** {{GENERATIVE_DESCRIPTION}}
**User Provided Refinements:** {{ADDITIONAL_DESCRIPTION}}

**Specific Paths for this Tool Generation:**
- Tool Base Path: `{{TOOL_BASE_PATH}}`
- Server Component Path: `{{SERVER_COMPONENT_PATH}}`
- Client Component Path: `{{CLIENT_COMPONENT_PATH}}` (Client Component Name: `{{COMPONENT_NAME}}Client.tsx`)
- Metadata Path: `{{METADATA_PATH}}`
---

END FILE: app/api/generate-tool-resources/\_prompts/00_task_definition.md ---
