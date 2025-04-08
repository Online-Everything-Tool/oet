// components/ShoelaceSetup.tsx
"use client";

import { useEffect } from 'react';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

let basePathHasBeenSet = false;

export default function ShoelaceSetup() {
  useEffect(() => {
    if (!basePathHasBeenSet) {
      // Use the path corresponding to your `postinstall` script destination
      const assetsPath = '/assets'; // <-- CORRECTED PATH
      setBasePath(assetsPath);
      console.log(`Shoelace base path set to: ${assetsPath}`); // Will log '/assets'

      basePathHasBeenSet = true;
    }
  }, []);

  return null;
}