// FILE: app/_components/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHistory } from '@/app/context/HistoryContext';


export default function Header() {
  const { history, isLoaded } = useHistory();
  // Calculate count only when history is loaded to avoid showing 0 briefly
  const historyCount = isLoaded ? history.length : 0;
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
          {/* History Link Wrapper (Needed for relative positioning of badge) */}
          <div className="relative inline-block">
             <Link
                href="/history"
                className="px-2 py-1 text-sm font-medium rounded hover:bg-[rgba(255,255,255,0.1)] flex items-center transition-colors duration-200" // Adjusted padding slightly
                aria-label="View History"
                title="View History"
             >
                 <span style={{ fontSize: '1.75rem' }} aria-hidden="true">
                    📝
                 </span>
                 {/* History Counter Badge */}
                 {isLoaded && historyCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-yellow-400 text-gray-900 text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4" // Fine-tuned position & padding
                      title={`${historyCount} history entries`}
                      aria-hidden="true"
                    >
                    {historyCount > 99 ? '99+' : historyCount} {/* Limit displayed count */}
                  </span>
                 )}
                 <span className="sr-only">History ({historyCount} items)</span>
             </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}