// app/sw.ts
/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

// --- Add this Declaration Merging Block ---
import type { PrecacheEntry } from "serwist";
declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
// --- End Declaration Merging Block ---


import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
// Optional: Import Workbox strategies if needed
// import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

const SERWIST_VERSION = `oet-${new Date().toISOString()}`;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST, // Now TypeScript knows this property might exist
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();

console.log(`Serwist v${SERWIST_VERSION} initialized.`);