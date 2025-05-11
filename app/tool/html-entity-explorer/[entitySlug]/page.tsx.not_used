// FILE: app/tool/html-entity-explorer/[entitySlug]/page.tsx
import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import HtmlEntityExplorerClient from '../_components/HtmlEntityExplorerClient';
import { notFound } from 'next/navigation';
import toolPageMetadata from '../metadata.json';

// --- Types ---
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
// --- End Types ---

// --- Data Loading and Processing Logic ---
async function loadAndProcessAllEntities(): Promise<{
  entities: RichEntityData[];
  categories: string[];
}> {
  const filePath = path.join(
    process.cwd(),
    'app',
    'tool',
    'html-entity-explorer',
    '_data',
    'html-entities-data.json'
  );
  let jsonData: CategorizedRawData;
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    jsonData = JSON.parse(fileContent);
    if (
      typeof jsonData !== 'object' ||
      jsonData === null ||
      Array.isArray(jsonData)
    ) {
      console.error(
        ' [Server EntitySlugPage] Unexpected JSON structure. Path:',
        filePath
      );
      return { entities: [], categories: [] };
    }
  } catch (error) {
    console.error(
      ' [Server EntitySlugPage] Error reading/parsing entity data:',
      error
    );
    return { entities: [], categories: [] };
  }

  const uniqueEntitiesMap = new Map<string, Omit<RichEntityData, 'id'>>();
  const categoriesSet = new Set<string>();
  for (const categoryName in jsonData) {
    if (
      !Object.prototype.hasOwnProperty.call(jsonData, categoryName) ||
      !Array.isArray(jsonData[categoryName])
    )
      continue;
    categoriesSet.add(categoryName);
    for (const item of jsonData[categoryName]) {
      if (!item || typeof item !== 'object') continue;
      const code =
        (typeof item.hex === 'string' && item.hex.trim()) ||
        (typeof item.dec === 'string' && item.dec.trim()) ||
        null;
      let char = typeof item.character === 'string' ? item.character : null;
      if (!code) continue;
      const isNBSPCode = code === ' ' || code === ' ' || code === ' ';
      if (isNBSPCode) {
        if (char === null || char === '') char = '\u00A0';
      } else {
        char = char === null || char.trim() === '' ? null : char;
      }
      if (char === null) continue;
      const entityName =
        typeof item.entity === 'string' &&
        item.entity.startsWith('&') &&
        item.entity.endsWith(';')
          ? item.entity.trim()
          : code;
      // Use item.name from JSON as the primary source for RichEntityData.description
      const description =
        (typeof item.name === 'string' && item.name.trim()) ||
        'No description available';
      const processedEntity = {
        name: entityName,
        code: code,
        char: char,
        description: description,
        category: categoryName,
      };
      const uniqueKey = `${processedEntity.category}-${processedEntity.code}-${processedEntity.name}`;
      if (!uniqueEntitiesMap.has(uniqueKey)) {
        uniqueEntitiesMap.set(uniqueKey, processedEntity);
      }
    }
  }
  const finalEntities: RichEntityData[] = Array.from(
    uniqueEntitiesMap.values()
  ).map((entity) => ({ ...entity, id: uuidv4() }));
  const categories = Array.from(categoriesSet).sort();
  return { entities: finalEntities, categories };
}
// --- End Data Loading ---

interface EntityPageParams {
  entitySlug: string;
}

function generateEntitySlug(entity: Omit<RichEntityData, 'id'>): string {
  let baseSlug = '';

  // Prioritize description for slug generation
  if (entity.description && entity.description !== 'No description available') {
    baseSlug = entity.description
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace one or more spaces with a single hyphen
      .replace(/[^a-z0-9-]/g, '') // Remove any character that is not a letter, number, or hyphen
      .replace(/-+/g, '-') // Replace multiple hyphens with a single one
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
  }

  // Fallback if description didn't yield a good slug
  if (!baseSlug) {
    if (
      entity.name &&
      entity.name.startsWith('&') &&
      entity.name.endsWith(';') &&
      entity.name.length > 2
    ) {
      baseSlug = entity.name
        .substring(1, entity.name.length - 1) // Use entity name without &;
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, ''); // Basic clean
    } else {
      // Further fallback to code, cleaned
      baseSlug = entity.code.replace(/[#&;x]/gi, '').toLowerCase();
    }
  }

  // Final absolute fallback to prevent empty slugs, and truncate
  return baseSlug.substring(0, 70) || `entity-${entity.char.charCodeAt(0)}`;
}

export async function generateStaticParams(): Promise<EntityPageParams[]> {
  const { entities } = await loadAndProcessAllEntities();
  if (!entities || entities.length === 0) {
    console.error(
      '[EntitySlugPage] No entities found for generateStaticParams.'
    );
    return [];
  }

  const paramsSet = new Set<string>();
  const staticParams: EntityPageParams[] = [];

  entities.forEach((entity) => {
    const slug = generateEntitySlug(entity);
    if (slug && !paramsSet.has(slug)) {
      staticParams.push({ entitySlug: slug });
      paramsSet.add(slug);
    } else if (slug && paramsSet.has(slug)) {
      console.warn(
        `[EntitySlugPage] generateStaticParams: Duplicate slug generated and skipped: '${slug}' for entity named '${entity.name}' (desc: '${entity.description}')`
      );
    } else if (!slug) {
      console.warn(
        `[EntitySlugPage] generateStaticParams: Empty slug generated for entity named '${entity.name}' (desc: '${entity.description}')`
      );
    }
  });
  return staticParams;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<EntityPageParams>;
}) {
  const { entities } = await loadAndProcessAllEntities();
  // Find entity using the same slug generation logic
  const { entitySlug } = await params;
  const entity = entities.find(
    (e) => generateEntitySlug(e) === entitySlug
  );

  if (!entity) {
    return {
      title: 'HTML Entity Not Found | OET',
      description: 'The requested HTML entity could not be found.',
    };
  }
  const title = `${entity.char} ${entity.description && entity.description !== 'No description available' ? entity.description : entity.name} (${entity.code}) | HTML Entity Explorer | OET`;
  const description = `Details for HTML entity "${entity.description && entity.description !== 'No description available' ? entity.description : entity.name}" (${entity.char}): Named entity ${entity.name}, Code ${entity.code}. Category: ${entity.category}. Explore and copy HTML character entities.`;
  return {
    title,
    description,
    openGraph: {
      title: title,
      description: `Explore the HTML entity ${entity.description && entity.description !== 'No description available' ? entity.description : entity.name} (${entity.char}) and its details.`,
      // url: `/tool/html-entity-explorer/${params.entitySlug}`, // Construct full URL here
      // images: [ /* Potentially an image of the character */ ]
    },
  };
}

export default async function SingleHtmlEntityPage({
  params,
}: {
  params: Promise<EntityPageParams>;
}) {
  const { entitySlug } = await params;
  const { entities, categories } = await loadAndProcessAllEntities();

  const featuredEntity = entities.find(
    (e) => generateEntitySlug(e) === entitySlug
  );

  if (!featuredEntity) {
    notFound();
  }

  const mainExplorerToolRoute = '/tool/html-entity-explorer';
  const pageTitle = `${featuredEntity.char} ${featuredEntity.description && featuredEntity.description !== 'No description available' ? featuredEntity.description : featuredEntity.name}`;
  const pageDescription = `Details for ${pageTitle}. Use the explorer below to find more HTML entities, search, and filter by category.`;

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={mainExplorerToolRoute} />
      <ToolHeader title={pageTitle} description={pageDescription} />
      <HtmlEntityExplorerClient
        initialEntities={entities}
        availableCategories={categories}
        featuredEntity={featuredEntity}
      />
    </div>
  );
}
