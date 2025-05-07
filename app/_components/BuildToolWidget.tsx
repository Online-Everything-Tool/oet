// FILE: app/_components/BuildToolWidget.tsx
import React from 'react';
import Link from 'next/link';

interface BuildToolWidgetProps {
  suggestedDirectives: string[];
  modelNameUsed?: string | null;
}

export default function BuildToolWidget({
  suggestedDirectives,
  modelNameUsed,
}: BuildToolWidgetProps) {
  return (
    <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm space-y-4">
      {/* Main Build Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3 text-[rgb(var(--color-text-base))]">
          Build a New Tool
        </h2>
        <p className="text-[rgb(var(--color-text-muted))] mb-4">
          Have an idea for another useful client-side utility? Build it with AI
          assistance!
        </p>
        <Link
          href="/build-tool/"
          className="inline-block px-5 py-2 bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] font-medium text-sm rounded-md shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors"
        >
          Build a Tool
        </Link>
        <p className="text-[rgb(var(--color-text-muted))] mt-4">
          Use AI (Gemini) to validate the directive and attempt to generate a
          proof-of-concept tool. Successful generations will result in a pull
          request for review and potential inclusion in the site.
        </p>
      </div>

      {/* AI Suggestions Section (Conditional) */}
      {suggestedDirectives && suggestedDirectives.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Need Inspiration? AI Suggestions:
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {suggestedDirectives.map((directive) => (
              <li key={directive} className="text-sm">
                <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">
                  {directive}
                </code>
              </li>
            ))}
          </ul>
          {modelNameUsed && (
            <p className="text-xs text-gray-400 mt-2">
              Suggestions generated using {modelNameUsed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
