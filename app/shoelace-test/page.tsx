// /app/shoelace-test/page.tsx
'use client';

// Import only useState (no useRef/useEffect needed here for listeners)
import React, { useState, useCallback } from 'react';
import ClientOnly from '@/components/ClientOnly';

// Import Shoelace components
import '@shoelace-style/shoelace/dist/components/radio/radio.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';

type TestOption = 'option1' | 'option2' | 'option3';

export default function ShoelaceTestPage() {
  const [selectedValue, setSelectedValue] = useState<TestOption>('option1');
  const [feedback, setFeedback] = useState<string>('No event captured yet.');

  // --- Event handler function ---
  // useCallback ensures the function identity is stable if needed elsewhere,
  // though less critical here as it's only used in the ref callbacks below.
  const handleSlChangeEvent = useCallback((event: Event) => {
    console.log("[Test Page] sl-change event fired via callback ref. Target:", event.target);
    setFeedback("sl-change event FIRED via callback ref!");

    const targetElement = event.target as HTMLInputElement;
    if (targetElement && 'value' in targetElement && targetElement.checked) {
      const newOptionValue = targetElement.value as TestOption;
      console.log("[Test Page] Value extracted from checked radio:", newOptionValue);
      // Update state only if value changed
      setSelectedValue((prevValue) => {
          if (prevValue !== newOptionValue) {
              console.log(`[Test Page] State updated to: ${newOptionValue}`);
              return newOptionValue;
          }
          console.log(`[Test Page] Value unchanged: ${newOptionValue}`);
          return prevValue; // Keep previous value if same option clicked
      });

    } else {
      console.warn("[Test Page] Could not get value or target not checked.");
      setFeedback("sl-change Fired, but couldn't get value or target wasn't checked.");
    }
  }, []); // Empty dependency array for useCallback as it doesn't depend on component state directly

  // --- Callback Ref Function ---
  // This function will be called by React when the ref is attached/detached
  const radioRefCallback = useCallback((node: HTMLElement | null) => {
    // If node exists (ref attached), add listener
    if (node) {
      console.log(`[Test Page] Attaching 'sl-change' listener to node:`, node);
      node.addEventListener('sl-change', handleSlChangeEvent);
      // Store cleanup needed? React might handle detachment for callback refs implicitly,
      // but explicit cleanup is safer if we stored the node elsewhere.
      // For simplicity here, we rely on the listener being removed when the node is removed from DOM.
    }
    // NOTE: If the element is removed/re-added, React calls this again with null, then the new node.
    // We are NOT explicitly removing the listener here on detachment (when node is null).
    // This is generally okay if the component/node is fully unmounted. If nodes are frequently
    // swapped *without* unmounting the parent, manual cleanup tracking would be needed.
  }, [handleSlChangeEvent]); // Depend on the handler function

  const handleButtonClick = () => {
    console.log("[Test Page] sl-button clicked!");
    setFeedback("Shoelace button clicked!");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shoelace Test Page</h1>
      <p>Testing Shoelace component integration and event handling.</p>

      <ClientOnly>
        {/* Test 1: Basic Component Rendering & Asset Loading */}
        <div className="p-4 border rounded">
             <sl-button variant="primary" onClick={handleButtonClick}>
              <sl-icon slot="prefix" name="gear"></sl-icon>
              Test Button
            </sl-button>
             {/* ... */}
        </div>

        {/* Test 2: Individual sl-radio Event Handling via Callback Ref */}
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">Individual sl-radio Event Test (Callback Ref)</h2>
          <fieldset>
             <legend className="block text-sm font-medium text-gray-700 mb-1">Select an Option:</legend>
             <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                 {/* Assign the callback function to the ref prop */}
                 <sl-radio
                     ref={radioRefCallback} // Use the callback
                     name="testOptions"
                     value="option1"
                     checked={selectedValue === 'option1'}
                     class="mr-4"
                 >
                     Option 1
                 </sl-radio>
                 <sl-radio
                     ref={radioRefCallback} // Use the callback
                     name="testOptions"
                     value="option2"
                     checked={selectedValue === 'option2'}
                     class="mr-4"
                 >
                     Option 2
                 </sl-radio>
                 <sl-radio
                     ref={radioRefCallback} // Use the callback
                     name="testOptions"
                     value="option3"
                     checked={selectedValue === 'option3'}
                 >
                     Option 3
                 </sl-radio>
            </div>
          </fieldset>
          <p className="mt-2 text-sm">Change the selection and check the console/feedback text.</p>
        </div>

        {/* Feedback Area */}
        <div className="p-4 border rounded bg-gray-100">
             <h2 className="text-lg font-semibold mb-2">Status / Feedback</h2>
            <p className="font-mono text-sm">Current State Value: <strong>{selectedValue}</strong></p>
            <p className="font-mono text-sm">Event Feedback: <strong>{feedback}</strong></p>
        </div>
      </ClientOnly>
    </div>
  );
}