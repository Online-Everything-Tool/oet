// src/types/file-icons-js.d.ts
declare module 'file-icons-js' {
  interface FileIconOptions {
    // file-icons-js's getClass doesn't seem to take options directly in the way I previously assumed.
    // The color is handled by getClassWithColor or by passing a mode to the Icon instance's getClass method.
    // For simplicity, we'll just type what's directly exported and used.
  }

  // This is the Icon class instance that db.matchName(name) would return
  interface IconInstance {
    getClass: (
      colourMode?: number | null,
      asArray?: boolean
    ) => string | string[];
    // Add other properties of IconInstance if needed (icon, colour, match, priority etc.)
  }

  // This is the IconTables instance
  interface IconTablesAPI {
    matchName: (name: string, directory?: boolean) => IconInstance | null;
    // Add other methods of IconTables if needed (matchPath, matchLanguage etc.)
  }

  export const db: IconTablesAPI;
  export function getClass(
    filename: string,
    match?: IconInstance | null
  ): string | null;
  export function getClassWithColor(
    filename: string,
    match?: IconInstance | null
  ): string | null;
}
