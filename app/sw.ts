// app/sw.ts

export type {};
declare const self: ServiceWorkerGlobalScope;

import type { PrecacheEntry, RouteMatchCallback } from 'serwist';
declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
import { NetworkOnly } from '@serwist/strategies';

const SERWIST_VERSION = `oet-${new Date().toISOString()}`;

const suggestToolMatcher: RouteMatchCallback = ({
  url /* , request, event */,
}) => {
  return url.pathname === '/suggest-tool';
};

const suggestToolRule = {
  matcher: suggestToolMatcher,
  handler: new NetworkOnly({}),
  method: 'GET' as const,
};

const customRuntimeCaching = [suggestToolRule, ...defaultCache];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: customRuntimeCaching,
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

serwist.addEventListeners();

console.log(`Serwist v${SERWIST_VERSION} initialized.`);
