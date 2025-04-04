export default function Home() {
  // Add any state or handlers needed for the homepage here later

  return (
    // You might want a container and some layout styling here
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-800">Welcome to the Online Everything Tool</h1>
      <p className="text-lg text-gray-600">
        Your one-stop utility for client-side data transformations, conversions, and more.
      </p>

      {/* Add links to your tools here eventually */}
      <div className="mt-8 p-4 border rounded-lg bg-white shadow">
         <h2 className="text-xl font-semibold mb-3">Available Tools:</h2>
         <ul className="list-disc list-inside space-y-1">
           {/* Example links - update these later */}
           <li><a href="/reverser" className="text-purple-600 hover:underline">Text Reverser</a></li>
           <li><a href="/word-counter" className="text-purple-600 hover:underline">Word Counter</a></li>
           <li><a href="/json-formatter-validator" className="text-purple-600 hover:underline">JSON Formatter/Validator</a></li>
           <li><a href="/emojis" className="text-purple-600 hover:underline">Emoji Explorer</a></li>
           <li><a href="/url-decode-encode" className="text-purple-600 hover:underline">URL Decode/Encode</a></li>
           <li><a href="/case-converter" className="text-purple-600 hover:underline">Case Converter</a></li>
           <li><a href="/base64-converter" className="text-purple-600 hover:underline">Base64 Converter</a></li>
           <li><a href="/hash-generator" className="text-purple-600 hover:underline">Hash Generator</a></li>
           {/* Add links to other tools as they are built */}
         </ul>
      </div>

    </div>
  );
}