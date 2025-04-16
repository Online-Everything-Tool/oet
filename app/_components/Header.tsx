// FILE: app/_components/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHistory } from '@/app/context/HistoryContext';


export default function Header() {
  const { history, isLoaded } = useHistory(); // Re-added isLoaded
  const historyCount = history.length;  
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <header className="bg-[rgb(var(--color-button-primary-bg))] text-white shadow-md sticky top-0 z-50">
      <nav className="container mx-auto max-w-6xl px-4 py-3 flex justify-between items-center">
        {/* Logo/Home Link */}
        <Link href="/" passHref legacyBehavior>
          <a className="text-xl font-bold hover:text-indigo-200 transition-colors duration-200">
            OET
          </a>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-4">
           {/* Build Tool Link */}
           {isHome && (
             <Link href="/build-tool" passHref legacyBehavior>
                 <a className="text-sm font-medium hover:text-indigo-200 transition-colors duration-200 px-3 py-1 rounded hover:bg-[rgba(255,255,255,0.1)]">
                    Build Tool
                 </a>
             </Link>
            )}
          {/* History Link with Icon */}
          <div className="relative inline-block">
                 <Link
                    href="/history"
                    className="px-3 py-1 text-sm font-medium rounded hover:bg-[rgba(255,255,255,0.1)] flex items-center transition-colors duration-200"
                    aria-label="View History"
                    title="View History"
                 >
                     <span style={{ fontSize: '1.75rem' }} aria-hidden="true">
                        📝
                     </span>
                     {isLoaded && historyCount > 0 && (
                        <span
                          className="absolute top-0 right-0 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-yellow-400 text-gray-800 text-[10px] font-bold pointer-events-none" // Adjusted badge position & size
                          title={`${historyCount} history entries`}
                          aria-hidden="true"
                        >
                        {historyCount}
                      </span>
                     )}                     
                     <span className="sr-only">History</span>                     
                 </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}