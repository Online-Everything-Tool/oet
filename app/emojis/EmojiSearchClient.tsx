// /app/emoji/EmojiSearchClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { RichEmojiData } from './page';

// --- Refined Helper Function ---
// Utility to get unique sorted values from an array of objects, filtering out unwanted ones
const getUniqueSortedValues = (
  items: RichEmojiData[],
  key: keyof RichEmojiData,
  sort: 'asc' | 'desc' | 'version-desc' = 'asc' // Add sorting options
): string[] => {
  // Early exit if no items
  if (!items || items.length === 0) {
    // console.log(`getUniqueSortedValues for ${key}: No items provided.`); // Debugging
    return [];
  }

  const values = new Set<string>();
  items.forEach(item => {
    const value = item[key];
    // Add validation: check if value exists, is a string, is not empty, and not 'Unknown'
    if (value && typeof value === 'string' && value.trim() !== '' && value !== 'Unknown') {
      values.add(value);
    }
  });

  // Convert Set to Array for sorting
  const sortedValues = Array.from(values);

  // Apply specific sorting logic
  if (sort === 'version-desc') {
    // Sort versions numerically, newest first (handles "13.1", "2.0" etc.)
    sortedValues.sort((a, b) => parseFloat(b) - parseFloat(a));
  } else if (sort === 'desc') {
    // Standard descending string sort
    sortedValues.sort((a, b) => b.localeCompare(a));
  } else {
    // Standard ascending string sort (default)
    sortedValues.sort((a, b) => a.localeCompare(b));
  }

  // console.log(`getUniqueSortedValues for ${key}:`, sortedValues); // Debugging
  return sortedValues;
};


interface EmojiSearchClientProps {
  initialEmojis: RichEmojiData[];
}

export default function EmojiSearchClient({ initialEmojis }: EmojiSearchClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // --- Filter State ---
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');

  // --- Initial Data Check (Debugging) ---
  useEffect(() => {
      console.log("EmojiSearchClient received initialEmojis:", initialEmojis?.length, "items. First item:", initialEmojis?.[0]);
      if (!initialEmojis || initialEmojis.length === 0) {
          console.warn("EmojiSearchClient received empty or no initialEmojis array. Check server-side fetching/parsing.");
      }
  }, [initialEmojis]);


  // --- Memoized Filter Options ---
  const availableGroups = useMemo(() => {
    console.log('Calculating availableGroups...'); // Debugging
    return getUniqueSortedValues(initialEmojis, 'group', 'asc');
  }, [initialEmojis]);

  const availableVersions = useMemo(() => {
    console.log('Calculating availableVersions...'); // Debugging
    return getUniqueSortedValues(initialEmojis, 'version', 'version-desc');
  }, [initialEmojis]);

  const availableSubgroups = useMemo(() => {
    console.log(`Calculating availableSubgroups for selectedGroup: '${selectedGroup}'`); // Debugging
    if (!selectedGroup) {
      return []; // No group selected, no subgroups needed
    }
    // Filter emojis matching the *selected* group first
    const filteredByGroup = initialEmojis.filter(e => e.group === selectedGroup);
    // Then get unique subgroups from that filtered list
    return getUniqueSortedValues(filteredByGroup, 'subgroup', 'asc');
  }, [initialEmojis, selectedGroup]); // Recalculate ONLY when initial data or selectedGroup changes


  // --- Calculate Active Filter Count ---
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGroup) count++;
    // Only count subgroup if it's selected *and* its corresponding group is also selected
    if (selectedSubgroup && selectedGroup) count++;
    if (selectedVersion) count++;
    return count;
  }, [selectedGroup, selectedSubgroup, selectedVersion]);


  // --- Combined Filtering Logic ---
  const filteredEmojis = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

    // Start with all emojis and progressively filter
    return initialEmojis.filter(emoji => {
      // 1. Filter by Search Term (if any)
      if (lowerCaseSearchTerm && !emoji.name.toLowerCase().includes(lowerCaseSearchTerm)) {
        return false;
      }
      // 2. Filter by Group (if selected)
      if (selectedGroup && emoji.group !== selectedGroup) {
        return false;
      }
      // 3. Filter by Subgroup (only if group and subgroup are selected)
      if (selectedGroup && selectedSubgroup && emoji.subgroup !== selectedSubgroup) {
        return false;
      }
      // 4. Filter by Version (if selected)
      if (selectedVersion && emoji.version !== selectedVersion) {
        return false;
      }
      // If it passed all checks, include it
      return true;
    });
  }, [searchTerm, initialEmojis, selectedGroup, selectedSubgroup, selectedVersion]);

  // --- Event Handlers ---
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(prev => !prev);
  };

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newGroup = event.target.value;
    setSelectedGroup(newGroup);
    setSelectedSubgroup(''); // Reset subgroup when group changes
  };

  const handleSubgroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubgroup(event.target.value);
  };

  const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersion(event.target.value);
  };

  const handleClearFilters = useCallback(() => {
    setSelectedGroup('');
    setSelectedSubgroup('');
    setSelectedVersion('');
  }, []);


  // --- Render ---
  return (
    <div className="flex flex-col gap-5">
      {/* --- Search and Filter Trigger Row --- */}
      <div className="flex gap-3 items-center">
        {/* Search Input */}
        <div className="flex-grow">
          <label htmlFor="emoji-search" className="sr-only">Search Emojis</label>
          <input
            type="search" id="emoji-search" value={searchTerm} onChange={handleSearchChange}
            placeholder="Search by name (e.g., smile, heart, cat)..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
          />
        </div>
        {/* Filter Trigger Button w/ Badge */}
        <div className="relative">
          <button onClick={toggleFilterPanel} title={isFilterPanelOpen ? "Hide Filters" : "Show Filters"} aria-expanded={isFilterPanelOpen}
            className="p-3 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
          >
            {/* Gear Icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {/* Active Filter Count Badge */}
          {activeFilterCount > 0 && (
             <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-medium text-white">
               {activeFilterCount}
             </span>
           )}
        </div>
      </div>

      {/* --- Filter Panel (Conditional) --- */}
      {isFilterPanelOpen && (
        <div className="p-4 border border-gray-200 rounded-md bg-gray-50 flex flex-col gap-4">
           <div className="flex justify-between items-center">
             <h3 className="text-lg font-medium text-gray-700">Filter Options</h3>
              <button onClick={handleClearFilters} disabled={activeFilterCount === 0}
                 className="px-3 py-1 rounded text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:text-gray-400 disabled:hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-purple-500"
              >Clear Filters</button>
           </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Group Filter */}
            <div>
              <label htmlFor="filter-group" className="block text-sm font-medium text-gray-700 mb-1">Group</label>
              <select id="filter-group" value={selectedGroup} onChange={handleGroupChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                {/* Add key to static option */}
                <option key="all-groups" value="">All Groups</option>
                {/* Check if availableGroups has items before mapping */}
                {availableGroups && availableGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            {/* Subgroup Filter */}
            <div>
              <label htmlFor="filter-subgroup" className="block text-sm font-medium text-gray-700 mb-1">Subgroup</label>
              <select id="filter-subgroup" value={selectedSubgroup} onChange={handleSubgroupChange}
                disabled={!selectedGroup || availableSubgroups.length === 0} // Disable if no group selected OR if the selected group has no valid subgroups
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-500"
              >
                 {/* Add key to static option */}
                <option key="all-subgroups" value="">All Subgroups</option>
                {/* Only map if group is selected and subgroups exist */}
                {selectedGroup && availableSubgroups && availableSubgroups.map(subgroup => (
                    <option key={subgroup} value={subgroup}>{subgroup}</option>
                ))}
              </select>
            </div>

            {/* Version Filter */}
            <div>
              <label htmlFor="filter-version" className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <select id="filter-version" value={selectedVersion} onChange={handleVersionChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                 {/* Add key to static option */}
                <option key="all-versions" value="">All Versions</option>
                 {/* Check if availableVersions has items before mapping */}
                {availableVersions && availableVersions.map(version => (
                    <option key={version} value={version}>Emoji {version}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* --- Results Count --- */}
      <p className="text-sm text-gray-500">
        Showing {filteredEmojis.length} of {initialEmojis.length} emojis.
      </p>

      {/* --- Emoji Display Grid --- */}
      {/* Error/Empty States */}
      {initialEmojis.length === 0 && (<p className="text-red-600">Could not load emoji data. Check console for errors.</p>)}
      {initialEmojis.length > 0 && filteredEmojis.length === 0 && (searchTerm || activeFilterCount > 0) && (<p className="text-gray-600">No emojis found matching your search and filter criteria.</p>)}

      {/* Grid Rendering */}
      {filteredEmojis.length > 0 && (
         <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
           {/* Ensure key is unique and stable - codePoints should work if parsing is correct */}
           {filteredEmojis.map(({ emoji, name, codePoints }) => (
             <button
               key={codePoints || name} // Fallback to name if codePoints somehow missing, though ideally fix parsing
               title={`${name}\nCode: ${codePoints}`}
               className="flex items-center justify-center p-2 text-3xl sm:text-4xl bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 transition duration-150 ease-in-out aspect-square"
               onClick={() => navigator.clipboard?.writeText(emoji)}
               aria-label={`Copy emoji: ${name}`}
             >
               {emoji}
             </button>
           ))}
         </div>
       )}
    </div>
  );
}