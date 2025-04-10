// /app/html-entities/page.tsx
import fs from 'fs/promises';
import path from 'path';
import EntitySearchClient from './EntitySearchClient';
import { v4 as uuidv4 } from 'uuid';

// --- Define structures matching html-entities-data.json ---
interface RawEntityItem {
  name?: string;
  character?: string;
  unicode?: string;
  hex?: string;
  dec?: string;
  entity?: string;
  css?: string;
}

interface CategorizedRawData {
  [category: string]: RawEntityItem[];
}

// --- Define the final data structure passed to the client ---
export interface RichEntityData {
  id: string; // Guaranteed unique ID for React key
  name: string;
  code: string;
  char: string;
  description: string;
  category: string;
}

// --- Function to load and process entity data (Server Side) ---
async function loadAndProcessEntities(): Promise<RichEntityData[]> {
  const filePath = path.join(process.cwd(), 'app', 'html-entities', 'html-entities-data.json');
  let jsonData: CategorizedRawData;

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    jsonData = JSON.parse(fileContent);
    if (typeof jsonData !== 'object' || jsonData === null || Array.isArray(jsonData)) {
      console.error(" [Server] Unexpected JSON structure: Expected an object of categories. Path:", filePath);
      return [];
    }
  } catch (error) {
    console.error(" [Server] Error reading or parsing entity data file:", error);
    return [];
  }

  // Map for de-duplication based on category + code
  const uniqueEntitiesMap = new Map<string, Omit<RichEntityData, 'id'>>();

  for (const categoryName in jsonData) {
    if (!Object.prototype.hasOwnProperty.call(jsonData, categoryName) || !Array.isArray(jsonData[categoryName])) {
        continue; // Skip invalid category entries silently
    }

    const entityArray = jsonData[categoryName];

    for (const item of entityArray) {
      if (!item || typeof item !== 'object') {
        continue; // Skip invalid items silently
      }

      const code = (typeof item.hex === 'string' && item.hex.trim()) ||
                   (typeof item.dec === 'string' && item.dec.trim()) || null;
      let char = (typeof item.character === 'string') ? item.character : null;

      if (!code) {
        continue; // Skip items missing code
      }

      // Special handling for nbsp
      if (code === ' ' || code === ' ') {
          if (char === null || char === '') {
              char = '\u00A0';
          }
      }
      // Use nbsp if still empty/null, otherwise skip if empty
      if (char === null || char.trim() === '') {
          if (code === ' ' || code === ' ') {
              char = '\u00A0';
          } else {
             continue; // Skip other items with missing characters
          }
      }

      let entityName = (typeof item.entity === 'string' && item.entity.startsWith('&') && item.entity.endsWith(';'))
                         ? item.entity.trim()
                         : code;
      const description = (typeof item.name === 'string' && item.name.trim()) || 'No description available';

      const processedEntity = {
        name: entityName,
        code: code,
        char: char,
        description: description,
        category: categoryName,
      };

      const uniqueKey = `${processedEntity.category}-${processedEntity.code}`;
      if (!uniqueEntitiesMap.has(uniqueKey)) {
        uniqueEntitiesMap.set(uniqueKey, processedEntity);
      }
      // If duplicate key exists, we simply ignore the current item
    }
  }

  // Add unique ID after de-duplication
  const finalEntities: RichEntityData[] = Array.from(uniqueEntitiesMap.values()).map(entity => ({
      ...entity,
      id: uuidv4(),
  }));

  console.log(` [Server] Processed ${finalEntities.length} unique entities.`);
  return finalEntities;
}

// --- The Page Component ---
export default async function HtmlEntityPage() {
  const initialEntities = await loadAndProcessEntities();

  if (initialEntities.length === 0) {
    // Log only if loading actually failed or resulted in zero valid entities
    console.warn(" [Server] HtmlEntityPage: No entities loaded or processed successfully.");
  }

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">HTML Entity Explorer</h1>
      <p className="mb-6 text-gray-600">
        Search for HTML entities by name, code, character, or description. Click to copy.
      </p>
      <EntitySearchClient initialEntities={initialEntities} />
    </main>
  );
}