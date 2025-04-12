// /app/build-tool/_components/GenerateToolResources.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ValidationResult, GenerationResult } from '../page'; // Import shared types

// Define the props expected by this component
interface GenerateToolResourcesProps { // Renamed Props Interface
    toolDirective: string;
    validationResult: ValidationResult; // Contains generativeDescription and generativeRequestedDirectives
    additionalDescription: string;
    setAdditionalDescription: (value: string) => void;
    selectedModel: string; // Model used for validation, passed to generation
    onGenerationSuccess: (result: GenerationResult) => void; // Callback on success
    onBack: () => void; // Function to go back to validation step
}

// Interface matching the expected API response structure from the renamed endpoint
interface ApiGenerationResponseData {
    success: boolean;
    message: string;
    generatedCode: string | null;
}

// Component renamed to match the core action/API more specifically
export default function GenerateToolResources({
    toolDirective,
    validationResult,
    additionalDescription, setAdditionalDescription,
    selectedModel,
    onGenerationSuccess, onBack
}: GenerateToolResourcesProps) { // Use renamed Props Interface

    // Local state for this step's operations
    const [isGenerating, setIsGenerating] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'error'>('idle');

    // Handler for the "Generate Code Preview" button click
    const handleGenerateClick = async () => {
        setStatus('idle');
        setFeedback(null);
        setIsGenerating(true);
        setFeedback('Generating tool resources (page.tsx)...'); // Updated feedback text

        if (!selectedModel) { setStatus('error'); setFeedback('Error: AI model selection missing.'); setIsGenerating(false); return; }
        if (!validationResult.generativeDescription) { setStatus('error'); setFeedback('Error: AI description is missing.'); setIsGenerating(false); return; }

        try {
            // Call the renamed API endpoint
            const response = await fetch('/api/generate-tool-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Payload remains the same logically
                    toolDirective: toolDirective,
                    generativeDescription: validationResult.generativeDescription,
                    additionalDescription: additionalDescription.trim(),
                    modelName: selectedModel,
                    generativeRequestedDirectives: validationResult.generativeRequestedDirectives,
                }),
            });

            const data: ApiGenerationResponseData = await response.json();

            if (!response.ok || !data.success || !data.generatedCode) {
                throw new Error(data.message || `Resource generation failed (${response.status})`);
            }

            // Generation Successful
            onGenerationSuccess({
                generatedCode: data.generatedCode,
                message: data.message // Pass message (could be success or warning)
            });
            setFeedback(null);
            setStatus('idle');

        } catch (error: unknown) {
            console.error("Tool Resource Generation Error:", error);
            setStatus('error');
            const message = error instanceof Error ? error.message : "Unexpected error during resource generation.";
            setFeedback(`Generation Error: ${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // JSX remains structurally the same, just uses the new component name context
    return (
         <section className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isGenerating ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-indigo-300'}`}>
            {/* Title reflects the step/purpose */}
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Step 2: Refine & Generate Resources</h2>

             {/* Display AI Generated Description */}
             <div className="mb-4">
                <label htmlFor="genDescDisplay" className="block text-sm font-medium text-gray-700 mb-1">
                    AI Generated Description (Review):
                </label>
                <textarea id="genDescDisplay" readOnly value={validationResult.generativeDescription} rows={2}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 sm:text-sm resize-none"
                />
             </div>

             {/* Display Requested Directives */}
             {validationResult.generativeRequestedDirectives.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded">
                    <p className="text-sm font-medium text-indigo-800 mb-1">
                        AI Requested Implementation Examples:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                        {validationResult.generativeRequestedDirectives.map(directive => (
                            <li key={directive} className="text-sm text-indigo-700">
                                <Link href={`/t/${directive}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                                    {directive}
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs text-indigo-600">The AI will use code from these tools as a guide.</p>
                </div>
             )}

            {/* Additional Details Input */}
            <div className="mb-4">
                <label htmlFor="additionalDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Details / Refinements (Optional):
                </label>
                <textarea id="additionalDescription" value={additionalDescription} onChange={(e)=>setAdditionalDescription(e.target.value)} rows={4}
                    disabled={isGenerating}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-y disabled:bg-gray-100"
                    placeholder="Add specific details, edge cases, UI preferences..."
                />
                 <p className="mt-1 text-xs text-gray-500">Provide extra context to help the AI generate the `page.tsx` file.</p>
            </div>

            {/* Buttons: Generate and Back */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                 <button
                    type="button" onClick={handleGenerateClick}
                    disabled={isGenerating}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {/* Updated button text */}
                    {isGenerating ? 'Generating Resources...' : 'Generate page.tsx Preview'}
                </button>
                <button
                    type="button" onClick={onBack} disabled={isGenerating}
                    className="text-sm text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50"
                 >
                    Back to Validation
                 </button>
            </div>


             {/* Feedback Area */}
             {feedback && (
                 <div className={`mt-4 text-sm p-3 rounded ${ status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200' }`}>
                    {feedback}
                 </div>
             )}
        </section>
    );
}