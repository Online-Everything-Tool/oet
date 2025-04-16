// FILE: app/tool/html-entity-explorer/page.tsx
import fs from 'fs/promises';
import path from 'path';
import HtmlEntityExplorerClient from './_components/HtmlEntityExplorerClient';
import { v4 as uuidv4 } from 'uuid';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';

// Interfaces remain the same
interface RawEntityItem { name?: string; character?: string; unicode?: string; hex?: string; dec?: string; entity?: string; css?: string; }
interface CategorizedRawData { [category: string]: RawEntityItem[]; }
export interface RichEntityData { id: string; name: string; code: string; char: string; description: string; category: string; }

// Server-side data fetching function corrected
async function loadAndProcessEntities(): Promise<{ entities: RichEntityData[], categories: string[] }> {
  const filePath = path.join(process.cwd(), 'app', 'tool', 'html-entity-explorer', '_data', 'html-entities-data.json');
  let jsonData: CategorizedRawData;
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    jsonData = JSON.parse(fileContent);
    if (typeof jsonData !== 'object' || jsonData === null || Array.isArray(jsonData)) {
      console.error(" [Server] Unexpected JSON structure: Expected an object of categories. Path:", filePath);
      return { entities: [], categories: [] };
    }
  } catch (error) {
    console.error(" [Server] Error reading or parsing entity data file:", error);
    return { entities: [], categories: [] };
  }
  const uniqueEntitiesMap = new Map<string, Omit<RichEntityData, 'id'>>();
  const categoriesSet = new Set<string>();
  let totalSkipped = 0;
  for (const categoryName in jsonData) {
    if (!Object.prototype.hasOwnProperty.call(jsonData, categoryName) || !Array.isArray(jsonData[categoryName])) { continue; }
    categoriesSet.add(categoryName);
    const entityArray = jsonData[categoryName];
    for (const item of entityArray) {
      if (!item || typeof item !== 'object') { totalSkipped++; continue; }
      // *** FIXED Typo: 'stringSearch' -> 'string' ***
      const code = (typeof item.hex === 'string' && item.hex.trim()) || (typeof item.dec === 'string' && item.dec.trim()) || null;
      let char = (typeof item.character === 'string') ? item.character : null;

      if (!code) { totalSkipped++; continue; }

      // Handle NBSP specifically using hex/dec codes
      const isNBSPCode = code === ' ' || code === ' ' || code === '\u00A0';

      if (isNBSPCode) {
        if (char === null || char === '') char = '\u00A0'; // Ensure NBSP character if code matches
      } else {
         // Ensure char is not empty/whitespace for non-NBSP codes
         char = (char === null || char.trim() === '') ? null : char;
      }

      // If char is still null after processing, skip the entity
      if (char === null) { totalSkipped++; continue; }


      const entityName = (typeof item.entity === 'string' && item.entity.startsWith('&') && item.entity.endsWith(';')) ? item.entity.trim() : code;
      const description = (typeof item.name === 'string' && item.name.trim()) || 'No description available';
      const processedEntity = { name: entityName, code: code, char: char, description: description, category: categoryName };
      const uniqueKey = `${processedEntity.category}-${processedEntity.code}`;
      if (!uniqueEntitiesMap.has(uniqueKey)) { uniqueEntitiesMap.set(uniqueKey, processedEntity); } else { totalSkipped++; }
    }
  }
  const finalEntities: RichEntityData[] = Array.from(uniqueEntitiesMap.values()).map(entity => ({ ...entity, id: uuidv4() }));
  const categories = Array.from(categoriesSet).sort();
  console.log(` [Server] Processed ${finalEntities.length} unique entities across ${categories.length} categories (Skipped ${totalSkipped} items).`);
  return { entities: finalEntities, categories: categories };
}

export default async function HtmlEntityPage() {
  const { entities, categories } = await loadAndProcessEntities();
  const toolTitle = metadata.title || "Html Entity Explorer";
  const toolRoute = "/tool/html-entity-explorer";

  if (entities.length === 0) {
    console.warn(" [Server] HtmlEntityPage: No entities loaded or processed successfully.");
  }

  return (
    // Add relative positioning
    <div className="relative flex flex-col gap-6">
       {/* Render ToolSettings */}
       <ToolSettings toolRoute={toolRoute} />
      <ToolHeader
          title={toolTitle}
          description={metadata.description || ""}
      />
      <HtmlEntityExplorerClient initialEntities={entities} availableCategories={categories}/>
    </div>
  );
}