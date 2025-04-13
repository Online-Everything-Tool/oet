// /app/build-tool/_components/GenerateToolResources.tsx
'use client';

import React, { useState, useMemo } from 'react'; // Added useMemo
import Link from 'next/link';
// --- Updated Type Import ---
// Ensure GenerationResult in ../page.tsx is updated to include:
// generatedFiles: { [filePath: string]: string } | null;
// identifiedDependencies: LibraryDependency[] | null;
// (And define LibraryDependency interface)
import type { ValidationResult, GenerationResult, LibraryDependency } from '../page';

// --- Props expected by this component (Updated) ---
interface GenerateToolResourcesProps {
    toolDirective: string;
    validationResult: ValidationResult;
    additionalDescription: string;
    setAdditionalDescription: (value: string) => void;
    selectedModel: string;
    allAvailableToolDirectives: string[]; // NEW: List of all tool names
    userSelectedDirective: string | null; // NEW: State for user's choice
    setUserSelectedDirective: (value: string | null) => void; // NEW: Setter for user's choice
    onGenerationSuccess: (result: GenerationResult) => void;
    onBack: () => void;
}

// --- Interface matching the expected API response structure (Updated) ---
interface ApiGenerationResponseData {
    success: boolean;
    message: string;
    // Expecting an object mapping file paths to content
    generatedFiles: { [filePath: string]: string } | null;
    // Expecting an array of identified dependencies
    identifiedDependencies: LibraryDependency[] | null;
}

export default function GenerateToolResources({
    toolDirective,
    validationResult,
    additionalDescription, setAdditionalDescription,
    selectedModel,
    allAvailableToolDirectives, // Destructure new props
    userSelectedDirective,      // Destructure new props
    setUserSelectedDirective,   // Destructure new props
    onGenerationSuccess, onBack
}: GenerateToolResourcesProps) {

    const [isGenerating, setIsGenerating] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'error'>('idle');

    // Memoize the filtered list of directives for the dropdown
    const availableUserChoices = useMemo(() => {
        const aiDirectives = new Set(validationResult.generativeRequestedDirectives || []);
        return allAvailableToolDirectives.filter(dir => !aiDirectives.has(dir));
    }, [allAvailableToolDirectives, validationResult.generativeRequestedDirectives]);

    const handleGenerateClick = async () => {
        setStatus('idle');
        setFeedback(null);
        setIsGenerating(true);
        // Updated feedback text to reflect multi-file potential
        setFeedback('Generating tool resources (code files & dependencies)...');

        if (!selectedModel) { setStatus('error'); setFeedback('Error: AI model selection missing.'); setIsGenerating(false); return; }
        if (!validationResult.generativeDescription) { setStatus('error'); setFeedback('Error: AI description is missing.'); setIsGenerating(false); return; }

        try {
            const response = await fetch('/api/generate-tool-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // --- Payload Updated ---
                    toolDirective: toolDirective,
                    generativeDescription: validationResult.generativeDescription,
                    additionalDescription: additionalDescription.trim(),
                    modelName: selectedModel,
                    generativeRequestedDirectives: validationResult.generativeRequestedDirectives,
                    userSelectedExampleDirective: userSelectedDirective // Add user's choice
                }),
            });

            // --- Parsing Updated Response Structure ---
            const data: ApiGenerationResponseData = await response.json();

            // Check for success and presence of generatedFiles (core requirement)
            if (!response.ok || !data.success || !data.generatedFiles) {
                throw new Error(data.message || `Resource generation failed (${response.status})`);
            }

            // --- Generation Successful - Pass Updated Structure ---
            onGenerationSuccess({
                // Pass the object of generated files
                generatedFiles: data.generatedFiles,
                // Pass identified dependencies (might be null/empty)
                identifiedDependencies: data.identifiedDependencies || null,
                // Pass any message from the API
                message: data.message
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

    return (
         <section className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isGenerating ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-indigo-300'}`}>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Step 2: Refine & Generate Resources</h2>

             {/* AI Generated Description (Review) */}
             <div className="mb-4">
                <label htmlFor="genDescDisplay" className="block text-sm font-medium text-gray-700 mb-1">
                    AI Generated Description (Review):
                </label>
                <textarea id="genDescDisplay" readOnly value={validationResult.generativeDescription} rows={2}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 sm:text-sm resize-none"
                />
             </div>

             {/* AI Requested Examples */}
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
                </div>
             )}

             {/* --- NEW: User Selected Additional Example --- */}
             <div className="mb-4">
                <label htmlFor="userExampleSelect" className="block text-sm font-medium text-gray-700 mb-1">
                    Select an Additional Example (Optional):
                </label>
                <select
                    id="userExampleSelect"
                    value={userSelectedDirective ?? ''} // Use nullish coalescing for controlled component
                    onChange={(e) => setUserSelectedDirective(e.target.value || null)} // Set null if default option selected
                    disabled={isGenerating || availableUserChoices.length === 0}
                    className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                    <option value="">-- None --</option>
                    {availableUserChoices.map(directive => (
                        <option key={directive} value={directive}>{directive}</option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                    Choose another existing tool if you think its code provides relevant patterns.
                    {availableUserChoices.length === 0 && allAvailableToolDirectives.length > 0 && " (All others already suggested by AI)"}
                </p>
             </div>
             {/* --- END NEW SECTION --- */}


            {/* Additional Details Input */}
            <div className="mb-4">
                <label htmlFor="additionalDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Details / Refinements (Optional):
                </label>
                <textarea id="additionalDescription" value={additionalDescription} onChange={(e)=>setAdditionalDescription(e.target.value)} rows={4}
                    disabled={isGenerating}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-y disabled:bg-gray-100"
                    placeholder="Add specific details, edge cases, UI preferences, libraries to avoid..."
                />
                 <p className="mt-1 text-xs text-gray-500">Provide extra context to help the AI generate the necessary code files.</p>
            </div>

            {/* Buttons: Generate and Back */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                 <button
                    type="button" onClick={handleGenerateClick}
                    disabled={isGenerating}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {/* Updated button text */}
                    {isGenerating ? 'Generating Resources...' : 'Generate Code Preview'}
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