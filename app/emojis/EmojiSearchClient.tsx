// /app/emoji/EmojiSearchClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { RichEmojiData } from './page';
import { useHistory } from '../context/HistoryContext'; // 1. Import useHistory

// Helper function (keep as is)
const getUniqueSortedValues = (/* ... */): string[] => {
    // ... function implementation ...
     if (!items || items.length === 0) { return []; }
     const values = new Set<string>();
     items.forEach(item => {
       const value = item[key];
       if (value && typeof value === 'string' && value.trim() !== '' && value !== 'Unknown') {
         values.add(value);
       }
     });
     const sortedValues = Array.from(values);
     if (sort === 'version-desc') { sortedValues.sort((a, b) => parseFloat(b) - parseFloat(a)); }
     else if (sort === 'desc') { sortedValues.sort((a, b) => b.localeCompare(a)); }
     else { sortedValues.sort((a, b) => a.localeCompare(b)); }
     return sortedValues;
};


interface EmojiSearchClientProps {
  initialEmojis: RichEmojiData[];
}

export default function EmojiSearchClient({ initialEmojis }: EmojiSearchClientProps) {
  // --- State and Context Hooks ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const { addHistoryEntry } = useHistory(); // 2. Get addHistoryEntry

  // --- Effect Hook (keep as is) ---
  useEffect(() => { /* ... */ }, [initialEmojis]);

  // --- Memoized Calculations (keep as is) ---
  const availableGroups = useMemo(() => getUniqueSortedValues(initialEmojis, 'group', 'asc'), [initialEmojis]);
  const availableVersions = useMemo(() => getUniqueSortedValues(initialEmojis, 'version', 'version-desc'), [initialEmojis]);
  const availableSubgroups = useMemo(() => { /* ... */ }, [initialEmojis, selectedGroup]);
  const activeFilterCount = useMemo(() => { /* ... */ }, [selectedGroup, selectedSubgroup, selectedVersion]);
  const filteredEmojis = useMemo(() => { /* ... */ }, [searchTerm, initialEmojis, selectedGroup, selectedSubgroup, selectedVersion]);

  // --- Event Handlers ---
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value);
  const toggleFilterPanel = () => setIsFilterPanelOpen(prev => !prev);
  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => { /* ... */ setSelectedGroup(event.target.value); setSelectedSubgroup(''); };
  const handleSubgroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => setSelectedSubgroup(event.target.value);
  const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) => setSelectedVersion(event.target.value);
  const handleClearFilters = useCallback(() => { /* ... */ setSelectedGroup(''); setSelectedSubgroup(''); setSelectedVersion(''); }, []);

  // --- 3. Modified Emoji Click Handler ---
  const handleEmojiClick = useCallback((emojiData: RichEmojiData) => {
    // Copy to clipboard (add basic error handling for unsupported browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(emojiData.emoji)
            .then(() => {
                // --- Add History Entry on Successful Copy ---
                addHistoryEntry({
                    toolName: 'Emoji Explorer',
                    toolRoute: '/emoji',
                    action: 'copy',
                    input: emojiData.name, // Use emoji name as 'input' for context
                    output: emojiData.emoji, // The copied emoji character
                    status: 'success',
                    // Options could include the filters active at the time, if desired
                    options: {
                       ...(selectedGroup && { group: selectedGroup }),
                       ...(selectedSubgroup && { subgroup: selectedSubgroup }),
                       ...(selectedVersion && { version: selectedVersion }),
                       ...(searchTerm && { searchTerm: searchTerm })
                    }
                });
                // Optional: Add temporary visual feedback for copy success
                // e.g., set some temporary state to show "Copied!"
                console.log(`Copied ${emojiData.emoji} to clipboard.`);
            })
            .catch(err => {
                console.error('Failed to copy emoji:', err);
                // Optionally log copy failure? Maybe not necessary for history.
            });
    } else {
        console.warn('Clipboard API not available.');
        // Handle fallback or just do nothing if clipboard isn't available
    }
  }, [addHistoryEntry, searchTerm, selectedGroup, selectedSubgroup, selectedVersion]); // Include dependencies for options logging


  // --- Render ---
  return (
    <div className="flex flex-col gap-5">
      {/* Search and Filter Trigger Row (keep as is) */}
      {/* ... */}
      <div className="flex gap-3 items-center">
        <div className="flex-grow">
           <label htmlFor="emoji-search" className="sr-only">Search Emojis</label>
           <input type="search" id="emoji-search" value={searchTerm} onChange={handleSearchChange} placeholder="Search by name..." className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"/>
        </div>
        <div className="relative">
           <button onClick={toggleFilterPanel} title={isFilterPanelOpen ? "Hide Filters" : "Show Filters"} aria-expanded={isFilterPanelOpen} className="p-3 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
           {activeFilterCount > 0 && (<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-medium text-white">{activeFilterCount}</span>)}
        </div>
      </div>

      {/* Filter Panel (Conditional - keep as is) */}
      {isFilterPanelOpen && (/* ... */)}
       {isFilterPanelOpen && (
         <div className="p-4 border border-gray-200 rounded-md bg-gray-50 flex flex-col gap-4">
           <div className="flex justify-between items-center">
             <h3 className="text-lg font-medium text-gray-700">Filter Options</h3>
              <button onClick={handleClearFilters} disabled={activeFilterCount === 0} className="px-3 py-1 rounded text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:text-gray-400 disabled:hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-purple-500">Clear Filters</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
               <label htmlFor="filter-group" className="block text-sm font-medium text-gray-700 mb-1">Group</label>
               <select id="filter-group" value={selectedGroup} onChange={handleGroupChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                 <option key="all-groups" value="">All Groups</option>
                 {availableGroups && availableGroups.map(group => (<option key={group} value={group}>{group}</option>))}
               </select>
             </div>
             <div>
               <label htmlFor="filter-subgroup" className="block text-sm font-medium text-gray-700 mb-1">Subgroup</label>
               <select id="filter-subgroup" value={selectedSubgroup} onChange={handleSubgroupChange} disabled={!selectedGroup || availableSubgroups.length === 0} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-500">
                 <option key="all-subgroups" value="">All Subgroups</option>
                 {selectedGroup && availableSubgroups && availableSubgroups.map(subgroup => (<option key={subgroup} value={subgroup}>{subgroup}</option>))}
               </select>
             </div>
             <div>
               <label htmlFor="filter-version" className="block text-sm font-medium text-gray-700 mb-1">Version</label>
               <select id="filter-version" value={selectedVersion} onChange={handleVersionChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                 <option key="all-versions" value="">All Versions</option>
                 {availableVersions && availableVersions.map(version => (<option key={version} value={version}>Emoji {version}</option>))}
               </select>
             </div>
           </div>
         </div>
       )}


      {/* Results Count (keep as is) */}
      {/* ... */}
        <p className="text-sm text-gray-500">Showing {filteredEmojis.length} of {initialEmojis.length} emojis.</p>


      {/* Emoji Display Grid (Modification in map) */}
      {/* Error/Empty States (keep as is) */}
      {/* ... */}
      {initialEmojis.length === 0 && (<p className="text-red-600">Could not load emoji data...</p>)}
      {initialEmojis.length > 0 && filteredEmojis.length === 0 && (searchTerm || activeFilterCount > 0) && (<p className="text-gray-600">No emojis found...</p>)}


      {/* Grid Rendering */}
      {filteredEmojis.length > 0 && (
         <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
           {/* Pass the full emojiData to the handler */}
           {filteredEmojis.map((emojiData) => ( // Get the whole object
             <button
               key={emojiData.codePoints || emojiData.name}
               title={`${emojiData.name}\nCode: ${emojiData.codePoints}`}
               className="flex items-center justify-center p-2 text-3xl sm:text-4xl bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 transition duration-150 ease-in-out aspect-square"
               // Call the new handler, passing the specific emoji's data
               onClick={() => handleEmojiClick(emojiData)}
               aria-label={`Copy emoji: ${emojiData.name}`}
             >
               {emojiData.emoji}
             </button>
           ))}
         </div>
       )}
    </div>
  );
}