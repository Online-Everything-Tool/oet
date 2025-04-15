// /app/build-tool/_components/GenerateToolResources.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
// Removed LibraryDependency as it's not directly used in this component
import type { ValidationResult, GenerationResult } from '../page';

// --- Props expected by this component ---
interface GenerateToolResourcesProps {
    toolDirective: string;
    validationResult: ValidationResult;
    additionalDescription: string;
    setAdditionalDescription: (value: string) => void;
    selectedModel: string;
    allAvailableToolDirectives: string[];
    userSelectedDirective: string | null;
    setUserSelectedDirective: (value: string | null) => void;
    onGenerationSuccess: (result: GenerationResult) => void;
    onBack: () => void;
}

// Interface matching the API response structure
// Assumes API returns { success, message, generatedFiles, identifiedDependencies }
interface ApiGenerationResponseData extends GenerationResult {
    success: boolean;
}

export default function GenerateToolResources({
    toolDirective,
    validationResult,
    additionalDescription, setAdditionalDescription,
    selectedModel,
    allAvailableToolDirectives,
    userSelectedDirective,
    setUserSelectedDirective,
    onGenerationSuccess, onBack
}: GenerateToolResourcesProps) {

    const [isGenerating, setIsGenerating] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'error'>('idle');

    const availableUserChoices = useMemo(() => {
        const aiDirectives = new Set(validationResult.generativeRequestedDirectives || []);
        return allAvailableToolDirectives.filter(dir => !aiDirectives.has(dir));
    }, [allAvailableToolDirectives, validationResult.generativeRequestedDirectives]);

    // --- Handle Generation API Call ---
    const handleGenerateClick = async () => {
        setStatus('idle');
        setFeedback(null);
        setIsGenerating(true);
        setFeedback('Generating files via API...');

        if (!selectedModel) {
            setStatus('error'); setFeedback('Error: AI model selection missing.'); setIsGenerating(false); return;
        }
        if (!validationResult.generativeDescription) {
            setStatus('error'); setFeedback('Error: AI-generated description is missing.'); setIsGenerating(false); return;
        }

        try {
            const response = await fetch('/api/generate-tool-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toolDirective: toolDirective,
                    generativeDescription: validationResult.generativeDescription,
                    additionalDescription: additionalDescription.trim(),
                    modelName: selectedModel,
                    generativeRequestedDirectives: validationResult.generativeRequestedDirectives,
                    userSelectedExampleDirective: userSelectedDirective
                }),
            });

            const data: ApiGenerationResponseData = await response.json();

            if (!response.ok || !data.success) {
                 throw new Error(data.message || `API request failed (${response.status})`);
            }

            if (data.generatedFiles && Object.keys(data.generatedFiles).length > 0) {
                 console.log("API call successful, received generated files and dependencies.");
                 // Pass data directly as it matches GenerationResult structure
                 onGenerationSuccess({
                     message: data.message,
                     generatedFiles: data.generatedFiles,
                     identifiedDependencies: data.identifiedDependencies // Will be array or null
                 });
                 setFeedback(null);
                 setStatus('idle');
             } else {
                 console.error("API reported success but returned no generated files.");
                 throw new Error(data.message || "Generation failed: API reported success but generated files were missing.");
             }

        } catch (error: unknown) {
            console.error("Tool Resource Generation Error:", error);
            setStatus('error');
            const message = error instanceof Error ? error.message : "Unexpected error during resource generation.";
            setFeedback(`Generation Error: ${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // --- JSX Render Logic (Remains the same) ---
    return (
         <section className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isGenerating ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-indigo-300'}`}>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Step 2: Refine & Generate Resources</h2>
             <div className="mb-4">
                <label htmlFor="genDescDisplay" className="block text-sm font-medium text-gray-700 mb-1"> AI Generated Description (Review): </label>
                <textarea id="genDescDisplay" readOnly value={validationResult.generativeDescription} rows={2} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 sm:text-sm resize-none" />
             </div>
             {validationResult.generativeRequestedDirectives.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded">
                    <p className="text-sm font-medium text-indigo-800 mb-1"> AI Requested Implementation Examples: </p>
                    <ul className="list-disc list-inside space-y-1"> {validationResult.generativeRequestedDirectives.map(directive => ( <li key={directive} className="text-sm text-indigo-700"> <Link href={`/tool/${directive}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900"> {directive} </Link> </li> ))} </ul>
                </div>
             )}
             <div className="mb-4">
                <label htmlFor="userExampleSelect" className="block text-sm font-medium text-gray-700 mb-1"> Select an Additional Example (Optional): </label>
                <select id="userExampleSelect" value={userSelectedDirective ?? ''} onChange={(e) => setUserSelectedDirective(e.target.value || null)} disabled={isGenerating || availableUserChoices.length === 0} className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" > <option value="">-- None --</option> {availableUserChoices.map(directive => ( <option key={directive} value={directive}>{directive}</option> ))} </select>
                <p className="mt-1 text-xs text-gray-500"> Choose another existing tool if its code provides relevant patterns. {availableUserChoices.length === 0 && allAvailableToolDirectives.length > 0 && " (All others already suggested by AI)"} </p>
             </div>
            <div className="mb-4">
                <label htmlFor="additionalDescription" className="block text-sm font-medium text-gray-700 mb-1"> Additional Details / Refinements (Optional): </label>
                <textarea id="additionalDescription" value={additionalDescription} onChange={(e)=>setAdditionalDescription(e.target.value)} rows={4} disabled={isGenerating} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-y disabled:bg-gray-100" placeholder="Add specific details, edge cases, UI preferences, libraries to avoid..." />
                 <p className="mt-1 text-xs text-gray-500">Provide extra context to help the AI generate the necessary code files.</p>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
                 <button type="button" onClick={handleGenerateClick} disabled={isGenerating} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" > {isGenerating ? 'Generating Files...' : 'Generate Tool Files'} </button>
                 <button type="button" onClick={onBack} disabled={isGenerating} className="text-sm text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50" > Back to Validation </button>
            </div>
             {feedback && ( <div className={`mt-4 text-sm p-3 rounded ${ status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200' }`}> {feedback} </div> )}
        </section>
    );
}