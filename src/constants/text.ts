// FILE: src/constants/text.ts

// (Moved from app/tool/case-converter/_components/CaseConverterClient.tsx)
export const CASE_TYPES = [
    { value: 'uppercase', label: 'UPPER CASE' },
    { value: 'lowercase', label: 'lower case' },
    { value: 'sentence', label: 'Sentence case' },
    { value: 'title', label: 'Title Case' },
    { value: 'camel', label: 'camelCase' },
    { value: 'pascal', label: 'PascalCase' },
    { value: 'snake', label: 'snake_case' },
    { value: 'kebab', label: 'kebab-case' },
  ] as const; // Keep as const for type safety
  
  // Derive the type from the constant array
  export type CaseType = typeof CASE_TYPES[number]['value'];
  
  // You could also export the type directly if preferred over deriving it elsewhere
  // export type CaseTypeValue = 'uppercase' | 'lowercase' | 'sentence' | 'title' | 'camel' | 'pascal' | 'snake' | 'kebab';