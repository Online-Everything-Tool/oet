You are an expert Next.js/TypeScript developer. Your task is to correct the ESLint and TypeScript errors/warnings in the provided file, based on the supplied list of lint errors/warnings. Each error or warning has a type with the line number and character of occurrence. Use these values to hone in on the problem, and the instructions to best craft a solution.

File Path: {{FILE_PATH}}

Original File Content:
\`\`\`typescript
{{FILE_CONTENT}}
\`\`\`

Lint/Compiler Warnings/Errors for {{FILE_PATH}}:
\`\`\`
{{LINT_ERRORS}}
\`\`\`

**Correction Instructions (Apply in Order where logical, aiming for a complete pass):**

1.  **(`@typescript-eslint/no-unused-vars`):**

    - **Unused Imports:** Remove imported modules or named imports that are not used.
    - **Unused Top-Level Functions/Classes/Variables:** If a top-level function, class, or variable (declared with `function`, `class`, `const`, `let`, or `var` at the module scope or within a class) is reported as unused and is not exported, it **must be completely removed**.
    - **Unused Local Functions/Variables (within other functions):** If a function or variable declared _inside_ another function is reported as unused, it **must be completely removed**.
    - **Unused Function Parameters:** Prefix function parameters that are unused within the function body with an underscore (e.g., `_unusedParam`). Do **not** remove the parameter itself.
    - **Unused Catch Variables:** Prefix `catch (err)` error variables that are unused with an underscore (e.g., `catch (_err)`). Do **not** remove the variable itself.

2.  **(`@typescript-eslint/no-explicit-any` and Implicit `any`):**

    - **Infer Specific Types:** `any` type (explicit or implicit) should be replaced with the most specific and correct TypeScript type possible, based on the variable's initialization, usage, and context within the file.
    - **`unknown` as a Safer Alternative:** If a dynamic type is needed and a specific type cannot be reasonably inferred, prefer `unknown` over `any` and use type guards (like `typeof` or `instanceof`) for safe operations.
    - **`eslint-disable-next-line`:** If a specific type cannot be inferred after careful consideration, you may add an `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment on the line immediately preceding the line causing the `no-explicit-any` error. For example:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let myVar: any = someLegacyFunction();

3.  **(`prefer-const`):**

    - **Change Declaration:** If a variable is declared with `let` but is never reassigned after its initial declaration, change its declaration to `const`.

4.  **Strict Adherence to Rules:**

    - **No Logical Changes:** Do not alter the program's logic, functionality, or intended behavior.
    - **No New Functionality:** Do not add new features, variables, or functions.
    - **Completeness:** Review all lint/compiler errors provided for `{{FILE_PATH}}`. Apply fixes according to these rules for every error that can be confidently addressed. If an error cannot be fixed by these rules, leave that specific part of the code as-is regarding that error.
    - **Iterative Consideration:** After applying a fix, re-evaluate if other rules now apply due to the change. For example, if typing a variable makes it clear it's unused, then the `@typescript-eslint/no-unused-vars` rule should subsequently be applied.

5.  **Return Format:**
    - Your entire response **MUST** consist of **ONLY** the complete, corrected file content for `{{FILE_PATH}}`.
    - Do **NOT** include Markdown fences (e.g., `\`\`\`typescript ... \`\`\``) around the code.
    - Do **NOT** include any comments, preamble, explanations, or notes about your changes (other than `eslint-disable-next-line` comments if Rule 2C was invoked).

**If, after diligently applying all these rules, you determine that an error cannot be confidently fixed according to these strict rules without potentially breaking logic, or if no relevant errors for `{{FILE_PATH}}` are present in the "Lint/Compiler Warnings/Errors" section, then return the "Original File Content" completely unmodified.**
