// /app/build-tool/_components/CreateAnonymousPr.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { GenerationResult, ValidationResult, PrSubmissionResult } from '../page';

// Define the props expected by this component
interface CreateAnonymousPrProps {
    toolDirective: string;
    generationResult: GenerationResult;
    validationResult: ValidationResult; // Contains generativeDescription & generativeRequestedDirectives
    additionalDescription: string;
    onPrSubmissionSuccess: (result: PrSubmissionResult) => void;
    onBack: () => void;
}

// Interface matching the expected API response structure
interface ApiPrSubmissionResponseData {
    success: boolean;
    message: string;
    url?: string | null;
}

export default function CreateAnonymousPr({
    toolDirective,
    generationResult,
    validationResult,
    additionalDescription,
    onPrSubmissionSuccess,
    onBack
}: CreateAnonymousPrProps) {

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'error'>('idle');

    const handleAnonymousSubmitClick = async () => {
        setStatus('idle'); setFeedback(null); setIsSubmitting(true);
        setFeedback('Submitting Pull Request to GitHub (anonymously)...');

        if (!generationResult.generatedCode) { setStatus('error'); setFeedback('Error: Generated code is missing.'); setIsSubmitting(false); return; }
        if (!toolDirective) { setStatus('error'); setFeedback('Error: Tool directive is missing.'); setIsSubmitting(false); return; }
        if (!validationResult?.generativeDescription) { console.warn("Generative description missing, PR body might be incomplete."); }


        try {
            const response = await fetch('/api/create-anonymous-pr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // --- CORRECTED Payload for API ---
                    toolDirective: toolDirective,
                    generatedPageTsx: generationResult.generatedCode,
                    // Pass descriptions and directives using consistent names
                    generativeDescription: validationResult.generativeDescription || `Code for ${toolDirective}`, // Fallback description
                    additionalDescription: additionalDescription || '',
                    generativeRequestedDirectives: validationResult.generativeRequestedDirectives || [], // Pass the directives
                }),
            });

            const data: ApiPrSubmissionResponseData = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || `PR submission failed (${response.status})`);
            }

            onPrSubmissionSuccess({ message: data.message, prUrl: data.url || null });
            setFeedback(null); setStatus('idle');

        } catch (error: unknown) {
            console.error("Anonymous PR Submission Error:", error);
            setStatus('error');
            const message = error instanceof Error ? error.message : "Unexpected error.";
            setFeedback(`PR Submission Error: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // JSX (Context display section is already correct from previous step)
    return (
         <section className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isSubmitting ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-purple-300'}`}>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Step 3: Review & Submit Anonymous PR</h2>

            {/* Generation Feedback */}
            {generationResult.message && ( <p className={`text-sm mb-4 p-2 rounded ${ generationResult.message.includes('warning') ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-700 border border-green-200' }`}> {generationResult.message} </p> )}

            {/* Review Context Section */}
            <div className="mb-4 space-y-3 p-3 bg-gray-50 border border-gray-200 rounded">
                 <p className="text-sm"><span className="font-medium text-gray-600">Target Directive:</span> <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs">{toolDirective}</code></p>
                 {validationResult?.generativeDescription && (<div><p className="text-sm font-medium text-gray-600">AI Description:</p><p className="text-sm text-gray-800 pl-2 italic">"{validationResult.generativeDescription}"</p></div>)}
                 {additionalDescription && (<div><p className="text-sm font-medium text-gray-600">Your Additional Details:</p><p className="text-sm text-gray-800 pl-2 whitespace-pre-wrap">{additionalDescription}</p></div>)}
                 {validationResult?.generativeRequestedDirectives && validationResult.generativeRequestedDirectives.length > 0 && (<div><p className="text-sm font-medium text-gray-600 mb-1">AI Requested Examples:</p><ul className="list-disc list-inside space-y-1 pl-2">{validationResult.generativeRequestedDirectives.map(d => ( <li key={d} className="text-sm text-indigo-700"><Link href={`/t/${d}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">{d}</Link></li> ))}</ul></div>)}
            </div>

            {/* Generated Code Display */}
            <div className="mb-4">
                <label htmlFor="generatedCodeDisplay" className="block text-sm font-medium text-gray-700 mb-1">Generated Code Preview (`page.tsx`):</label>
                <textarea id="generatedCodeDisplay" readOnly value={generationResult.generatedCode || ''} rows={20} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-900 text-gray-100 font-mono text-xs resize-y" spellCheck="false"/>
                <p className="mt-1 text-xs text-gray-500">Review the context and generated code. Submit anonymously if correct.</p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                 <button type="button" onClick={handleAnonymousSubmitClick} disabled={isSubmitting || !generationResult.generatedCode} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"> {isSubmitting ? 'Submitting Anonymously...' : 'Submit Anonymous PR'} </button>
                 <button type="button" onClick={onBack} disabled={isSubmitting} className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50">Back</button> {/* Simplified Back button text */}
             </div>

             {/* Feedback Area */}
             {feedback && ( <div className={`mt-4 text-sm p-3 rounded ${ status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200' }`}>{feedback}</div> )}
        </section>
    );
}