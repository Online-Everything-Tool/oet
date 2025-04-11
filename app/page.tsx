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

      {/* Add links to your tools here eventually */}
      <div className="mt-8 p-4 border rounded-lg bg-white shadow">
         <h2 className="text-xl font-semibold mb-3">Available Tools:</h2>
         <ul className="list-disc list-inside space-y-1">
           {/* Example links - update these later */}
           <li><a href="/t/crypto-wallet-generator" className="text-[#900027] hover:underline">Crypto Wallet Generator</a></li>
           <li><a href="/t/text-reverse" className="text-[#900027] hover:underline">Text Reverse</a></li>
           <li><a href="/t/text-counter" className="text-[#900027] hover:underline">Text Counter</a></li>
           <li><a href="/t/json-validator-formatter" className="text-[#900027] hover:underline">JSON Validator &  Formatter</a></li>
           <li><a href="/t/html-entities" className="text-[#900027] hover:underline">Html Entities Explorer</a></li>
           <li><a href="/t/emojis" className="text-[#900027] hover:underline">Emoji Explorer</a></li>
           <li><a href="/t/url-decode-encode" className="text-[#900027] hover:underline">URL Decode/Encode</a></li>
           <li><a href="/t/case-converter" className="text-[#900027] hover:underline">Case Converter</a></li>
           <li><a href="/t/base64-converter" className="text-[#900027] hover:underline">Base64 Converter</a></li>
           <li><a href="/t/hash-generator" className="text-[#900027] hover:underline">Hash Generator</a></li>
           <li><a href="/t/zip-file-explorer" className="text-[#900027] hover:underline">Zip File Explorer</a></li>
           {/* Add links to other tools as they are built */}
         </ul>
      </div>

              {/* Suggest a New Tool Section */}
      <div className="mt-8 p-4 border rounded-lg bg-white shadow">
          <h2 className="text-xl font-semibold mb-3">Suggest a New Tool</h2>
          <p className="text-gray-600 mb-4">
            Have an idea for another useful client-side utility? Help expand OET by suggesting it!
            Click the button below to open a pre-filled issue on GitHub.
          </p>
          <Link
            href="/suggest-tool"
            className="text-[#900027] hover:underline"
          >
            Suggest Tool
          </Link>
        </div>

    </div>
  );
}