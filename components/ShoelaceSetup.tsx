// components/ShoelaceSetup.tsx
"use client"; // <-- This component MUST be a Client Component

import { useEffect } from 'react';
// Import the utility from Shoelace
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

// Variable to ensure base path is set only once
let basePathHasBeenSet = false;

export default function ShoelaceSetup() {
  useEffect(() => {
    // Check if the base path has already been set in this session
    if (!basePathHasBeenSet) {

      // --- OPTION 1: Self-host assets (Recommended for Production) ---
      // This assumes you will copy Shoelace's assets to your `public/shoelace-assets` folder.
      // You'll need to add a script to your package.json to do this copy automatically.
      const assetsPath = '/'; // Path within your /public directory
      setBasePath(assetsPath);
      console.log(`Shoelace base path set to: ${assetsPath}`);

      // --- OPTION 2: Use CDN (Simpler Setup, External Dependency) ---
      // Replace '2.20.1' with the specific version of Shoelace you have installed.
      // const cdnPath = 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/cdn/';
      // setBasePath(cdnPath);
      // console.log(`Shoelace base path set via CDN: ${cdnPath}`);

      // Mark as set to prevent running again if component re-renders
      basePathHasBeenSet = true;
    }
  }, []); // Empty dependency array ensures this runs only once client-side after mount

  // This component doesn't render any visible elements
  return null;
}

// --- IMPORTANT ---
// If using Option 1 (Self-hosting), add this script to your package.json:
/*
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "cp -r node_modules/@shoelace-style/shoelace/dist/assets public/shoelace-assets" // Add this line
  },
*/
// After adding it, run `npm install` or `yarn install` or `pnpm install` again
// OR manually copy the folder:
// node_modules/@shoelace-style/shoelace/dist/assets  ->  public/shoelace-assets