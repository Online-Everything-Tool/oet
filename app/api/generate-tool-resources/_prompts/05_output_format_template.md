**Output Format:**
Return ONLY a single plain text block. Do NOT use any JSON or Markdown formatting for the overall response structure.

Within this single text block, provide the content for each generated file, plus identified dependencies, a message, and asset instructions (if any), using the following EXACT delimiter format:

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

**For asset instructions (OPTIONAL - only include this entire block if needed):**

---START_ASSET_INSTRUCTIONS---
This tool requires additional static assets. Please follow these instructions:

1. Client utilizes '/data/{{TOOL_DIRECTIVE}}/assets/X'.
   ---END_ASSET_INSTRUCTIONS---

**For the overall message:**

---START_MESSAGE---
Brief message about generation success including dependencies
---END_MESSAGE---

**Example of the complete plain text output structure (including optional hook, dependencies, and asset instructions):**

---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/page.tsx---
// ... page.tsx code ...
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/page.tsx---

---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/\_components/{{COMPONENT_NAME}}Client.tsx---
// ... client.tsx code ...
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/\_components/{{COMPONENT_NAME}}Client.tsx---

---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/\_hooks/use{{COMPONENT_NAME}}Client.ts---
// ... hooks code ...
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/\_hooks/use{{COMPONENT_NAME}}Client.ts---

---START_FILE:app/tool/{{TOOL_DIRECTIVE}}/metadata.json---
// ... metadata.json content ...
---END_FILE:app/tool/{{TOOL_DIRECTIVE}}/metadata.json---

---START_DEPS---
[
{"packageName": "face-api.js", "reason": "For face detection"}
]
---END_DEPS---

---START_ASSET_INSTRUCTIONS---
This tool utilizes face-api.js and requires its pre-trained models.

1. Model files should be placed in 'public/data/{{TOOL_DIRECTIVE}}/face-api-models/face_landmark_68_tiny_model-shard1'.
   ---END_ASSET_INSTRUCTIONS---

---START_MESSAGE---
Successfully generated resources for {{TOOL_DIRECTIVE}}. Note: This tool requires manual setup of face-api.js models as per dependencies and asset instructions.
---END_MESSAGE---
