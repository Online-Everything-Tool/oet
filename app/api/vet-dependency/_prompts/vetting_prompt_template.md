Analyze the NPM package `{{PACKAGE_NAME}}`. It is being considered as a dependency for a client-side browser-based utility tool called '{{TOOL_DIRECTIVE}}' whose function is described as: "{{TOOL_DESCRIPTION}}".
The project this tool belongs to ("Online Everything Tool") has a strict rule: **individual tools MUST NOT make external network calls** (e.g., to third-party APIs, CDNs for dynamic data/scripts, or for analytics/telemetry). All tool functionality must be self-contained in the browser after initial load, using only pre-packaged static assets if absolutely necessary (like local ML models).

Based _only_ on your general knowledge of `{{PACKAGE_NAME}}` and its common usage patterns in client-side JavaScript/TypeScript applications:

1.  **External Network Calls (`makesNetworkCalls`):**

    - Is `{{PACKAGE_NAME}}` **highly likely** to make outbound network calls by default or for its core functionality when used in a typical client-side browser application? (e.g., fetching data, submitting telemetry, loading external resources dynamically).
    - Respond with one of: "yes", "no", "likely_yes", "likely_no", or "unknown".
    - If "yes" or "likely_yes", briefly state why or what kind of calls.
    - If it _can_ make calls but also has a fully offline mode, clarify this. (e.g., "likely_no if models are hosted locally, yes if models fetched from CDN").

2.  **Relevance & Function (`isRelevant`, `primaryFunction`):**

    - Briefly describe the `primaryFunction` of `{{PACKAGE_NAME}}` (1 sentence).
    - Based on its function, is `{{PACKAGE_NAME}}` a `isRelevant` dependency for a tool like '{{TOOL_DIRECTIVE}}' which does "{{TOOL_DESCRIPTION}}"? (boolean: true/false)

3.  **Popularity/Quality Indication (`popularityIndication`):**

    - From your general knowledge, provide a qualitative `popularityIndication`. Choose one: "high" (very common, widely trusted, e.g., lodash, date-fns), "medium" (known, used, but not ubiquitous), "low" (less common, niche), "niche" (specialized, good for its purpose but not widely known), or "unknown".

4.  **Overall Assessment & Justification (`isLikelySafeAndRelevant`, `justification`):**
    - Considering all the above, especially the "no external network calls" rule and relevance, provide an overall boolean assessment `isLikelySafeAndRelevant` for including this in the project. It can only be `true` if `makesNetworkCalls` is "no" or "likely_no" (when used appropriately offline) AND `isRelevant` is true.
    - Provide a concise `justification` (1-2 sentences) explaining your overall assessment and any key considerations or warnings related to its use in a strictly client-side, no-external-calls context.

Respond ONLY with a single JSON object adhering to this structure (do not include any markdown like \`\`\`json):
{
"packageName": "{{PACKAGE_NAME}}",
"isLikelySafeAndRelevant": <boolean>,
"makesNetworkCalls": "<'yes'|'no'|'unknown'|'likely_no'|'likely_yes'>",
"justification": "<string>",
"popularityIndication": "<'high'|'medium'|'low'|'niche'|'unknown'>",
"primaryFunction": "<string>",
"isRelevant": <boolean>
}
