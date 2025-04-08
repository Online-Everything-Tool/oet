// /app/shoelace-test/page.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import { registerIconLibrary } from '@shoelace-style/shoelace/dist/utilities/icon-library.js';
// --- Import Shoelace types ---
import type SlRadioGroup from '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import type { SlChangeEvent } from '@shoelace-style/shoelace/dist/events/sl-change.js'; // Specific event type

// --- Import Shoelace component JS definitions ---
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/radio/radio.js';
// --- Add radio-group import ---
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';

let basePathHasBeenSet = false;
let iconLibraryRegistered = false;
const currentBasePath = '/assets';

type TestOption = 'option1' | 'option2' | 'option3';

export default function ShoelaceTestPage() {
  // State remains the same
  const [selectedValue, setSelectedValue] = useState<TestOption>('option1');
  const [feedback, setFeedback] = useState<string>('No event captured yet.');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Setup remains the same
    if (!basePathHasBeenSet) {
      setBasePath(currentBasePath);
      console.log(`[ShoelaceSetup] Base path set via setBasePath to: ${currentBasePath}`);
      basePathHasBeenSet = true;
    }
    if (!iconLibraryRegistered) {
      registerIconLibrary('default', {
        resolver: (name: string) => {
          const path = `${currentBasePath}/icons/${name}.svg`;
          console.log(`[Icon Library Resolver] Resolving icon "${name}" to: ${path}`);
          return path;
        },
      });
      console.log(`[ShoelaceSetup] Default icon library registered with custom resolver.`);
      iconLibraryRegistered = true;
    }
    setIsClient(true);
  }, []);

  // --- Updated Event Handler for sl-radio-group ---
  const handleRadioGroupChange = useCallback((event: Event) => {
    // Cast to the specific Shoelace event type for better property access
    const slEvent = event as SlChangeEvent;
    const radioGroup = slEvent.target as SlRadioGroup; // Target is the radio-group

    // The value of the selected radio is typically on the group's value property
    const newValue = radioGroup.value as TestOption;

    console.log("[Test Page] sl-change event fired on sl-radio-group. New value:", newValue);

    if (newValue) {
        setFeedback(`sl-change on Group: Value changed to ${newValue}`);
        setSelectedValue(newValue); // Update React state
    } else {
        console.warn("[Test Page] Could not get value from sl-radio-group change event.");
        setFeedback("sl-change on Group: Couldn't get value.");
    }
  }, []); // No dependencies needed

  // Button click handler remains the same
  const handleButtonClick = () => { /* ... */ };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shoelace Test Page</h1>
      <p>Testing Shoelace component integration (using sl-radio-group).</p>

      {isClient ? (
        <>
          {/* Button Test remains the same */}
          <div className="p-4 border rounded">
             {/* ... button with icon ... */}
          </div>

          {/* --- Test 2: Radio Buttons using sl-radio-group --- */}
          <div className="p-4 border rounded">
            <h2 className="text-lg font-semibold mb-2">sl-radio-group Event Test</h2>
            {/* Use sl-radio-group */}
            <sl-radio-group
              label="Select an Option" // Use the label prop for accessibility
              name="testOptionsGroup" // Can still use name if needed for forms
              value={selectedValue} // Control the group's value with React state
              onSlChange={handleRadioGroupChange} // Listen for sl-change on the GROUP
            >
              {/* Individual radios no longer need checked or event handlers */}
              <sl-radio value="option1">Option 1</sl-radio>
              <sl-radio value="option2">Option 2</sl-radio>
              <sl-radio value="option3">Option 3</sl-radio>
            </sl-radio-group>
            <p className="mt-2 text-sm">Change selection and check console/feedback. Event is handled by the group.</p>
          </div>

          {/* Feedback Area remains the same */}
          <div className="p-4 border rounded bg-gray-100">
            {/* ... feedback display ... */}
          </div>
        </>
      ) : (
        <div className="p-4 border rounded">Loading Shoelace components...</div>
      )}
    </div>
  );
}