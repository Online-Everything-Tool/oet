**Output Format:**
Return ONLY a single plain text block. Do NOT use any JSON or Markdown formatting for the overall response structure.

Within this single text block, provide the content for each generated file, plus identified dependencies and a message, using the following EXACT delimiter format:

**For each generated file:**

---START_FILE:{{Full_File_Path_From_Project_Root}}---
{{Complete_Raw_Source_Code_For_This_File}}
---END_FILE:{{Full_File_Path_From_Project_Root}}---

Replace `{{Full_File_Path_From_Project_Root}}` with the actual full path (e.g., `app/tool/{{TOOL_DIRECTIVE}}/page.tsx`, `app/tool/{{TOOL_DIRECTIVE}}/_components/{{COMPONENT_NAME}}Client.tsx`, `app/tool/{{TOOL_DIRECTIVE}}/_hooks/use{{COMPONENT_NAME}}.ts`, `app/tool/{{TOOL_DIRECTIVE}}/metadata.json`).
The content between the start and end file delimiters MUST be the complete, raw source code for that file. For `metadata.json`, this means the content will be a raw JSON string.

**For identified dependencies:**

---START_DEPS---
[
{"packageName": "string", "reason": "string (optional)", "importUsed": "string (optional)"}
// , ... more dependencies if any
]
---END_DEPS---

The content between `---START_DEPS---` and `---END_DEPS---` MUST be a valid JSON array string, or an empty array `[]` if no external dependencies are identified.

**For the overall message:**

---START_MESSAGE---
<Brief message about generation success or any warnings>
---END_MESSAGE---

**Example of the complete plain text output structure:**

```text
---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/page.tsx---
import React from 'react';
// ... content for page.tsx ...
export default function ToolPage() { /* ... */ }
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/page.tsx---

---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/_components/{{COMPONENT_NAME}}Client.tsx---
'use client';
// ... content for {{COMPONENT_NAME}}Client.tsx ...
export default function ToolClient() { /* ... */ }
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/_components/{{COMPONENT_NAME}}Client.tsx---

---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/metadata.json---
{
  "title": "{{TOOL_DIRECTIVE}}",
  "description": "Generated description here."
  // ... other metadata fields ...
}
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/metadata.json---

---START_DEPS---
[
  {"packageName": "example-lib", "reason": "Used for demonstration"}
]
---END_DEPS---

---START_MESSAGE---
Successfully generated resources for {{TOOL_DIRECTIVE}}.
---END_MESSAGE---


```
