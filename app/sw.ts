// app/sw.ts
/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

// --- Declaration Merging Block ---
// Import necessary types from serwist
import type { PrecacheEntry, RouteMatchCallback } from 'serwist';
declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
// --- End Declaration Merging Block ---

import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
import { NetworkOnly } from '@serwist/strategies'; // Ensure path is correct

const SERWIST_VERSION = `oet-${new Date().toISOString()}`;

// --- Define the Matcher Function Separately ---
// Annotate the function variable with the imported RouteMatchCallback type.
const suggestToolMatcher: RouteMatchCallback = ({
  url /* , request, event */,
}) => {
  // TypeScript should ideally infer that 'url' here is a URL object
  // based on the RouteMatchCallback signature. If it complains
  // about 'url' being 'any' or 'unknown', you might need to add
  // specific parameter typing like: ({ url }: { url: URL }) => ...
  // but try without it first.
  return url.pathname === '/suggest-tool';
};

// --- Prepare Custom Runtime Caching Rules ---
// Define the rule object for the /suggest-tool page
const suggestToolRule = {
  matcher: suggestToolMatcher, // Assign the typed function here
  handler: new NetworkOnly({}), // Use NetworkOnly strategy
  method: 'GET' as const, // Apply to GET requests (page loads)
};

// Combine the custom rule with the default rules.
// Place the specific rule *first* so it's matched before general rules.
const customRuntimeCaching = [
  suggestToolRule,
  ...defaultCache, // Spread the rest of the default Serwist/Workbox rules
];

// --- Instantiate Serwist with Custom Rules ---
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST, // Injected precache manifest
  skipWaiting: true, // Activate new SW immediately
  clientsClaim: true, // Take control of clients immediately
  navigationPreload: true, // Enable navigation preloads
  runtimeCaching: customRuntimeCaching, // Use the combined array with our custom rule
});

// --- Standard Event Listeners ---
// Listener for messages from the client (e.g., to skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Add Serwist's core event listeners (fetch, install, activate)
serwist.addEventListeners();

// Log initialization for debugging purposes
console.log(`Serwist v${SERWIST_VERSION} initialized.`);
