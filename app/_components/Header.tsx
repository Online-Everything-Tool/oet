// FILE: app/_components/Header.tsx
'use client';

import Link from 'next/link';
import { useHistory } from '@/app/context/HistoryContext';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';

export default function Header() {
  const { history, isLoaded } = useHistory(); // Re-added isLoaded
  const historyCount = history.length;

  return (
    <header className="bg-[#900027] text-white p-4 shadow-md sticky top-0 z-10">
      <nav className="container mx-auto flex justify-between items-center max-w-6xl">
        <Link href="/" className="text-xl font-bold transition-colors duration-150 ease-in-out">
          Online Everything Tool
        </Link>

        <div>
          {/* Using relative positioning on the wrapper for the badge */}
          <div className="relative inline-block align-middle">
            <Link
              href="/history"
              className="px-3 py-1 rounded transition-colors duration-150 ease-in-out text-sm font-medium hover:bg-white/10 flex items-center justify-center" // Adjusted padding/alignment
              aria-label={`View History (${historyCount} ${historyCount === 1 ? 'entry' : 'entries'})`} // Dynamic Aria Label
              title="View History" // Added title attribute for hover
            >
              {/* Shoelace Icon - Styling via style prop for reliability */}
              <sl-icon
                name="journal-text"
                label="History" // Keep internal label for accessibility tools
                style={{ fontSize: '1.5rem' }} // Use style prop for size
                aria-hidden="true"
              ></sl-icon>

            </Link>
             {/* Badge - positioned relative to the div wrapper */}
             {isLoaded && historyCount > 0 && (
              <span
                className="absolute top-0 right-0 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-yellow-400 text-gray-800 text-[10px] font-bold pointer-events-none" // Adjusted badge position & size
                title={`${historyCount} history entries`}
                aria-hidden="true"
              >
                {historyCount}
              </span>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}