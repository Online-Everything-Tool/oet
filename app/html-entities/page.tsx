// /app/html-entities/page.tsx
import fs from 'fs/promises';
import path from 'path';
import EntitySearchClient from './EntitySearchClient';
import { v4 as uuidv4 } from 'uuid';

// Interfaces remain the same
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

export interface RichEntityData {
  id: string;
  name: string;
  code: string;
  char: string;
  description: string;
  category: string;
}

// --- Function to load and process entity data (Server Side) ---
// Now returns both entities and the list of categories
async function loadAndProcessEntities(): Promise<{ entities: RichEntityData[], categories: string[] }> {
  const filePath = path.join(process.cwd(), 'app', 'html-entities', 'html-entities-data.json');
  let jsonData: CategorizedRawData;

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    jsonData = JSON.parse(fileContent);
    if (typeof jsonData !== 'object' || jsonData === null || Array.isArray(jsonData)) {
      console.error(" [Server] Unexpected JSON structure: Expected an object of categories. Path:", filePath);
      return { entities: [], categories: [] }; // Return empty data
    }
  } catch (error) {
    console.error(" [Server] Error reading or parsing entity data file:", error);
    return { entities: [], categories: [] }; // Return empty data
  }

  const uniqueEntitiesMap = new Map<string, Omit<RichEntityData, 'id'>>();
  const categoriesSet = new Set<string>(); // Use a Set to store unique category names
  let totalSkipped = 0;

  // Process Each Category and Entity
  for (const categoryName in jsonData) {
    if (!Object.prototype.hasOwnProperty.call(jsonData, categoryName) || !Array.isArray(jsonData[categoryName])) {
        continue;
    }

    // Add valid category name to the Set
    categoriesSet.add(categoryName);

    const entityArray = jsonData[categoryName];

    for (const item of entityArray) {
       // (Validation logic remains the same as the previous correct version)
      if (!item || typeof item !== 'object') {
        totalSkipped++;
        continue;
      }
      const code = (typeof item.hex === 'string' && item.hex.trim()) ||
                   (typeof item.dec === 'string' && item.dec.trim()) || null;
      let char = (typeof item.character === 'string') ? item.character : null;
      if (!code) {
        totalSkipped++;
        continue;
      }
      if (code === ' ' || code === ' ') {
          if (char === null || char === '') char = '\u00A0';
      }
       char = (char === null || char.trim() === '') ? '\u00A0' : char;
       if (char === '\u00A0' && !(code === ' ' || code === ' ')) {
         // If char became nbsp but wasn't originally, skip
         totalSkipped++;
         continue;
       }

      let entityName = (typeof item.entity === 'string' && item.entity.startsWith('&') && item.entity.endsWith(';'))
                         ? item.entity.trim() : code;
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
      } else {
        totalSkipped++;
      }
    }
  }

  // Add unique ID after de-duplication
  const finalEntities: RichEntityData[] = Array.from(uniqueEntitiesMap.values()).map(entity => ({
      ...entity,
      id: uuidv4(),
  }));

  // Convert Set to sorted array for consistent dropdown order
  const categories = Array.from(categoriesSet).sort();

  console.log(` [Server] Processed ${finalEntities.length} unique entities across ${categories.length} categories (Skipped ${totalSkipped} items).`);

  // Return both entities and categories
  return { entities: finalEntities, categories: categories };
}

// --- The Page Component ---
export default async function HtmlEntityPage() {
  // Destructure the result from the processing function
  const { entities, categories } = await loadAndProcessEntities();

  if (entities.length === 0) {
    console.warn(" [Server] HtmlEntityPage: No entities loaded or processed successfully.");
  }

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">HTML Entity Explorer</h1>
      <p className="mb-6 text-gray-600">
        Search for HTML entities by name, code, character, or description. Click to copy.
      </p>
      {/* Pass both initialEntities and availableCategories */}
      <EntitySearchClient initialEntities={entities} availableCategories={categories} />
    </main>
  );
}