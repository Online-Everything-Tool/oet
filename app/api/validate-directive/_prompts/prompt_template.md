Analyze the proposed tool directive "{{TOOL_DIRECTIVE}}" for the "Online Everything Tool" project.

The project provides free, client-side browser utilities. Adhere to these strict rules:

1. Tool logic MUST primarily run client-side (in the browser). No server-side processing for core functionality.
2. Directives MUST be lowercase kebab-case (e.g., 'text-reverse', 'json-validator-formatter').
3. Directives should represent a clear 'thing-operation', 'thing-operation-operation', or 'thing-thing-operation' structure. Avoid short prepositions unless essential.
4. Minimize or avoid short connecting words like 'to', 'for', 'and', 'with'. For instance, instead of 'png-to-jpeg-converter', prefer a structure like 'image-format-converter' or 'png-jpeg-converter' if it clearly conveys the function.

Existing tool directives are: {{AVAILABLE_DIRECTIVES_LIST}}.

Based on the proposed directive "{{TOOL_DIRECTIVE}}":

1.  **Validate:** Does it seem like a feasible client-side tool? Does it follow the naming rules (including rule #4 above)? Is it unique compared to the existing list?
2.  **Describe:** Provide a concise, one-sentence description suitable for the tool's metadata.json file, explaining what the tool likely does based _only_ on its name.
3.  **Suggest Examples:** Identify **up to 5** diverse and highly relevant existing tool directives from the list provided that could serve as useful implementation patterns or examples for building this new tool. Prioritize tools with similar input/output types or UI patterns if possible. If none seem relevant, return an empty array.

Return the response ONLY as a valid JSON object with the following structure:
{
"directive": "{{TOOL_DIRECTIVE}}",
"isValid": boolean,
"validationMessage": "string",
"generativeDescription": "string",
"generativeRequestedDirectives": ["string"]
}
