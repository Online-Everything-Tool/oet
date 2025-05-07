// FILE: src/constants/text.ts

export const CASE_TYPES = [
  { value: 'uppercase', label: 'UPPER CASE' },
  { value: 'lowercase', label: 'lower case' },
  { value: 'sentence', label: 'Sentence case' },
  { value: 'title', label: 'Title Case' },
  { value: 'camel', label: 'camelCase' },
  { value: 'pascal', label: 'PascalCase' },
  { value: 'snake', label: 'snake_case' },
  { value: 'kebab', label: 'kebab-case' },
] as const;

export type CaseType = (typeof CASE_TYPES)[number]['value'];
