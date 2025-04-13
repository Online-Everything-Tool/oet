// /app/page.tsx
import Link from 'next/link';

// TODO: Fetch tool list dynamically instead of hardcoding
// Example (conceptual - would require a server component or useEffect in client component):
// import { listTools } from '@/lib/tool-metadata'; // Assume a helper function exists
// const availableTools = await listTools(); // Fetch { directive, title, description }[]

export default function Home() {
  // --- Hardcoded list for now ---
  const tools = [
    { href: '/t/base64-converter', title: 'Base64 Converter' },
    { href: '/t/case-converter', title: 'Case Converter' },
    { href: '/t/crypto-wallet-generator', title: 'Crypto Wallet Generator' },
    { href: '/t/emoji-explorer', title: 'Emoji Explorer' },
    { href: '/t/hash-generator', title: 'Hash Generator' },
    { href: '/t/html-entity-explorer', title: 'Html Entity Explorer' },    
    { href: '/t/image-montage', title: 'Image Montage' },
    { href: '/t/json-validator-formatter', title: 'JSON Validator Formatter' },
    { href: '/t/random-password-generator', title: 'Random Password Generator' },
    { href: '/t/text-counter', title: 'Text Counter' },
    { href: '/t/text-reverse', title: 'Text Reverse' },
    { href: '/t/text-strike-through', title: 'Text Strike Through' },
    { href: '/t/url-decode-encode', title: 'URL Decode/Encode' },
    { href: '/t/zip-file-explorer', title: 'Zip File Explorer' },
  ];
  // --- End hardcoded list ---

  return (
    // Add overall page padding and max-width
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8"> {/* Increased max-width slightly, added vertical spacing */}    

        {/* Welcome Header */}
        <div className="text-center border-b border-[rgb(var(--color-border-base))] pb-6 mb-6"> {/* Added centering, border, margin */}
            <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--color-text-base))] mb-2"> {/* Explicit text color */}
                Online Everything Tool
            </h1>
            <p className="text-lg text-[rgb(var(--color-text-muted))]"> {/* Muted text color */}
                Your one-stop utility for client-side data transformations & generation.
            </p>
        </div>

      {/* Tool List Section */}
      {/* Using CSS variables for background and border */}
      <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-[rgb(var(--color-text-base))]"> {/* Explicit text color, margin */}
          Available Tools:
        </h2>
        {/* Check if tools exist before mapping */}
        {tools && tools.length > 0 ? (
            <ul className="list-disc list-inside space-y-1.5"> {/* Increased spacing */}
                {tools.map((tool) => (
                    <li key={tool.href}>
                        {/* Using CSS variable for link color */}
                        <Link href={tool.href} className="text-[rgb(var(--color-text-link))] hover:underline">
                            {tool.title} {/* Use title from data */}
                        </Link>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-[rgb(var(--color-text-muted))]">No tools available yet.</p>
        )}
      </div>

      {/* Build a New Tool Section */}
       {/* Using CSS variables for background and border */}
      <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm">
          <h2 className="text-xl font-semibold mb-3 text-[rgb(var(--color-text-base))]"> {/* Explicit text color */}
            Build a New Tool
          </h2>
          <p className="text-[rgb(var(--color-text-muted))] mb-4"> {/* Muted text color */}
            Have an idea for another useful client-side utility? Build it with AI assistance!
          </p>

          {/* Link Styled as Primary Button using CSS Variables */}
          <Link
            href="/build-tool"
            className="inline-block px-5 py-2 bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] font-medium text-sm rounded-md shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors" // Using variables, removed focus ring
          >
            Build a Tool
          </Link>
          {/* --- End Button Style --- */}

          <p className="text-[rgb(var(--color-text-muted))] mt-4"> {/* Muted text color */}
            Use AI (Gemini) to validate the directive and attempt to generate a proof-of-concept tool.
            Successful generations will result in a pull request for review and potential inclusion in the site.
          </p>
        </div>

    </div>
  );
}