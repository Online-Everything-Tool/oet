// src/types/file-icons-js.d.ts
declare module 'file-icons-js' {
  export function getClass(filename: string): string | null;
  export function getClassWithColor(filename: string): string | null;
}