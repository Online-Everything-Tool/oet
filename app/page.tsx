// /app/page.tsx
import Link from 'next/link';

export default function Home() {
  // Add any state or handlers needed for the homepage here later

  return (
    // You might want a container and some layout styling here
    <div className="space-y-2">
      <h1 className="text-3xl font-bold text-gray-800">Welcome to the Online Everything Tool</h1>
      <p className="text-lg text-gray-600">
        One-stop utility for client-side data transformations, conversions, and more.
      </p>

      {/* Tool List using Next.js Link */}
      <div className="mt-8 p-4 border rounded-lg bg-white shadow">
        <h2 className="text-xl font-semibold mb-3">Available Tools:</h2>
        <ul className="list-disc list-inside space-y-1">
            {/* Use Link for internal navigation */}
           <li><Link href="/t/base64-converter" className="text-[#900027] hover:underline">Base64 Converter</Link></li>
           <li><Link href="/t/case-converter" className="text-[#900027] hover:underline">Case Converter</Link></li>
           <li><Link href="/t/crypto-wallet-generator" className="text-[#900027] hover:underline">Crypto Wallet Generator</Link></li>
           <li><Link href="/t/hash-generator" className="text-[#900027] hover:underline">Hash Generator</Link></li>
           <li><Link href="/t/html-entities" className="text-[#900027] hover:underline">Html Entities Explorer</Link></li>
           <li><Link href="/t/emojis" className="text-[#900027] hover:underline">Emoji Explorer</Link></li>
           <li><Link href="/t/image-montage" className="text-[#900027] hover:underline">Image Montage</Link></li>
           <li><Link href="/t/json-validator-formatter" className="text-[#900027] hover:underline">JSON Validator Formatter</Link></li>
           <li><Link href="/t/text-counter" className="text-[#900027] hover:underline">Text Counter</Link></li>
           <li><Link href="/t/text-reverse" className="text-[#900027] hover:underline">Text Reverse</Link></li>
           <li><Link href="/t/text-strike-through" className="text-[#900027] hover:underline">Text Strike Through</Link></li>
           <li><Link href="/t/url-decode-encode" className="text-[#900027] hover:underline">URL Decode/Encode</Link></li>
           <li><Link href="/t/zip-file-explorer" className="text-[#900027] hover:underline">Zip File Explorer</Link></li>
           {/* Add links to other tools as they are built */}
        </ul>
      </div>

      {/* Build a New Tool Section - UPDATED with Button Style */}
      <div className="mt-8 p-4 border rounded-lg bg-white shadow">
          <h2 className="text-xl font-semibold mb-3">Build a New Tool</h2>
          <p className="text-gray-600 mb-4"> {/* Added bottom margin */}
            Have an idea for another useful client-side utility? Build it via prompt engineering!
          </p>

          {/* --- Link Styled as a Button --- */}
          <Link
            href="/build-tool" // Link still points to the correct page
            className="inline-block px-5 py-2 bg-[#900027] text-white font-medium text-sm rounded-md shadow-sm hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] transition-colors" // Button styles applied
          >
            Build a Tool
          </Link>
          {/* --- End Button Style --- */}

          <p className="text-gray-600 mt-4"> {/* Added top margin */}
            Use AI (Gemini) to validate the directive and attempt to generate a proof-of-concept tool.
            Successful generations will result in a pull request for review and potential inclusion in the site.
          </p>
        </div>

    </div>
  );
}