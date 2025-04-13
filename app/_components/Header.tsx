// /app/components/Header.tsx
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-[#900027] text-white p-4 shadow-md sticky top-0 z-10"> {/* Added sticky positioning */}
      <nav className="container mx-auto flex justify-between items-center max-w-6xl"> {/* Constrained width */}
        {/* Title/Logo Area */}
        <Link href="/" className="text-xl font-bold transition-colors duration-150 ease-in-out">
          Online Everything Tool
        </Link>

        {/* Navigation Links Area */}
        <div>
          <Link
            href="/history"
            className="px-3 py-2 rounded transition-colors duration-150 ease-in-out text-sm font-medium"
          >
            History
          </Link>
          {/* Placeholder for future links if needed */}
          {/* Example:
          <Link href="/settings" className="ml-4 px-3 py-2 rounded hover:bg-purple-600 transition-colors duration-150 ease-in-out text-sm font-medium">
            Settings
          </Link>
           */}
        </div>
      </nav>
    </header>
  );
}