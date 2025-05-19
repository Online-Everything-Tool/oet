**Output Format:**
Return ONLY a valid JSON object adhering EXACTLY to the following structure. Do NOT include any extra text, explanations, or markdown formatting outside the JSON structure itself.
The `generatedFiles` object MUST be a map where keys are the full relative file paths from the project root (e.g., "app/tool/{{TOOL_DIRECTIVE}}/page.tsx", "app/tool/{{TOOL_DIRECTIVE}}/\_components/{{COMPONENT_NAME}}Client.tsx", "app/tool/{{TOOL_DIRECTIVE}}/\_hooks/useLogic.ts") and values are the complete source code strings for EACH generated file.
The value for the metadata file (`app/tool/{{TOOL_DIRECTIVE}}/metadata.json`) MUST be a valid JSON _string_.
\`\`\`json
{
"message": "<Brief message about generation success or any warnings>",
"generatedFiles": {
"app/tool/{{TOOL_DIRECTIVE}}/page.tsx": "<Full source code for server component wrapper>",
"app/tool/{{TOOL_DIRECTIVE}}/\_components/{{COMPONENT_NAME}}Client.tsx": "<Full source code for main client component>",
"app/tool/{{TOOL_DIRECTIVE}}/metadata.json": "<JSON STRING for metadata file>"
},
"identifiedDependencies": [
{ "packageName": "string", "reason": "string (optional)", "importUsed": "string (optional)" }
]
}
\`\`\`
Ensure the code within "generatedFiles" values is complete and valid source code. Ensure the "metadata" value is a valid JSON _string_. Do not add comments like "// Content for ..." within the generated code strings unless they are actual necessary code comments.

CRITICAL REMINDER: When generating the string values for the `generatedFiles` map (which contain source code), all special characters _within that source code_, such as newlines, double quotes, and backslashes, MUST be properly escaped to form a valid JSON string. For example, a newline character in the code must become `\\n` in the JSON string value, and a double quote `"` in the code must become `\\"` in the JSON string value.
