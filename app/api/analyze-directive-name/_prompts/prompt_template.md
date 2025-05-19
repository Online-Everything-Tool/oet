Analyze the proposed tool directive \`{{PROPOSED_DIRECTIVE}}\` for a web application.

Application Purpose: {{APP_PURPOSE}}.
Existing Tool Directives: {{EXISTING_DIRECTIVES_LIST}}
Proposed Tool's Function (Generated Description): "{{GENERATIVE_DESCRIPTION}}"

Based ONLY on the information provided, evaluate the proposed directive:

1.  **Clarity & Conciseness:** Is the name clear and easy to understand?
2.  **Convention:** Does it follow common naming patterns (e.g., kebab-case)?
3.  **Redundancy:** Does it seem functionally very similar to an existing directive, suggesting a potentially better name or consolidation?
4.  **Typo Likelihood:** Is there a significant chance it's a typo of a more standard term or an existing directive (e.g., "test-" vs "text-", "covert" vs "convert")? Consider common English typos and the context of developer tools.
5.  **Suggestions:** If the name could be improved (due to typo, vagueness, or better alternatives), suggest 1-2 better names.

Respond ONLY with a single JSON object with the following structure:
\`\`\`json
{
"score": <A numerical score from 0.0 (very bad name / likely typo) to 1.0 (excellent name) representing the overall quality and appropriateness>,
"is_likely_typo": <boolean - true if a typo is strongly suspected>,
"suggestions": ["<alternative_name_1>", "<alternative_name_2>"],
"reasoning": "<A brief (1-2 sentence) explanation for the score and suggestions/typo assessment>"
}
\`\`\`
