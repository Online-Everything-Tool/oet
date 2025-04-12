// /app/build-tool/page.tsx
'use client';

import React, { useState, useEffect } from 'react';

// Define a type for the model structure
interface AiModel {
    name: string;
    displayName: string;
    version: string;
}

export default function BuildToolPage() {
  // --- Model Selection State ---
  const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(''); // Store the model NAME (ID)
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  // ---

  // Input state
  const [toolDirective, setToolDirective] = useState('');

  // Validation Step State
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);
  const [generativeDescription, setGenerativeDescription] = useState<string | null>(null);

  // Additional Description State
  const [additionalDescription, setAdditionalDescription] = useState('');

  // Generation Step State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [generationFeedback, setGenerationFeedback] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  // --- Fetch Models on Mount ---
  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetch('/api/list-models');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        const models: AiModel[] = data.models || []; // Ensure models is AiModel[]
        setAvailableModels(models);

        // --- UPDATED Default Model Selection Logic ---
        const defaultModelNameFromEnv = process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME;
        let defaultSet = false;

        console.log("Default model from ENV:", defaultModelNameFromEnv); // Log env var value

        if (models.length > 0) {
            // 1. Try to find the exact model from the environment variable
            if (defaultModelNameFromEnv) {
                const foundDefault = models.find(m => m.name === defaultModelNameFromEnv);
                if (foundDefault) {
                    setSelectedModel(foundDefault.name);
                    defaultSet = true;
                    console.log("Set default model from ENV:", foundDefault.name);
                } else {
                     console.warn(`Default model "${defaultModelNameFromEnv}" from env not found in available models.`);
                }
            }

            // 2. If ENV default wasn't found or not set, fall back to flash/pro/first logic
            if (!defaultSet) {
                const defaultFlash = models.find(m => m.name.includes('flash'));
                const defaultPro = models.find(m => m.name.includes('pro'));

                if (defaultFlash) {
                    setSelectedModel(defaultFlash.name);
                     console.log("Set default model to Flash:", defaultFlash.name);
                } else if (defaultPro) {
                    setSelectedModel(defaultPro.name);
                     console.log("Set default model to Pro:", defaultPro.name);
                } else {
                    setSelectedModel(models[0].name); // Fallback to the very first model
                     console.log("Set default model to first available:", models[0].name);
                }
            }
        } else {
             console.warn("No compatible AI models found after fetch.");
             // selectedModel remains ''
        }
        // --- END UPDATED Default Model Selection ---

      } catch (error) {
        console.error("Error fetching AI models:", error);
        const message = error instanceof Error ? error.message : "Could not load AI models.";
        setModelsError(message);
        setAvailableModels([]);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, []); // Empty dependency array means run once on mount
  // ---

  // Helper to format slug
  const formatSlug = (value: string): string => {
    if (typeof value !== 'string') return '';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleDirectiveChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolDirective(event.target.value);
      if (validationStatus !== 'idle' || generationStatus !== 'idle') {
          resetFlow();
      }
  };
  const handleAdditionalDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setAdditionalDescription(event.target.value);
  };

  // Function to reset the flow
  const resetFlow = () => {
      setValidationStatus('idle');
      setValidationFeedback(null);
      setGenerativeDescription(null);
      setAdditionalDescription('');
      setGenerationStatus('idle');
      setGenerationFeedback(null);
      setPrUrl(null);
      setIsValidating(false);
      setIsGenerating(false);
  };

  // --- Step 1: Validate Directive Handler (Unchanged functionally) ---
  const handleValidate = async () => {
    resetFlow();
    setIsValidating(true);
    setValidationFeedback('Validating directive with AI...');
    const finalDirective = formatSlug(toolDirective);

    if (!finalDirective) {
        setValidationStatus('error');
        setValidationFeedback('Please enter a valid tool directive (URL path).');
        setIsValidating(false); return;
    }
    if (!selectedModel) {
        setValidationStatus('error');
        setValidationFeedback('Please select an AI model first.');
        setIsValidating(false); return;
    }

    try {
      const response = await fetch('/api/validate-directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            toolDirective: finalDirective,
            modelName: selectedModel // Sends the currently selected model
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.valid) {
          throw new Error(data.message || `Validation failed with status ${response.status}`);
      }
      setValidationStatus('success');
      setGenerativeDescription(data.description || 'AI could not generate a description.');
      setValidationFeedback(data.message || 'Validation successful! Review description.');
    } catch (error: unknown) {
        console.error("Directive Validation Error:", error);
        setValidationStatus('error');
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        setValidationFeedback(`Validation Error: ${message}`);
        setGenerativeDescription(null);
    } finally {
        setIsValidating(false);
    }
  }; // End handleValidate

  // --- Step 2: Generate Tool Handler (Unchanged functionally) ---
  const handleGenerate = async () => {
    if (!generativeDescription || validationStatus !== 'success') {
        setGenerationStatus('error');
        setGenerationFeedback('Cannot generate tool without a validated directive.'); return;
    }
     if (!selectedModel) {
        setGenerationStatus('error');
        setGenerationFeedback('Cannot generate: AI model selection is missing.'); return;
    }

    setIsGenerating(true);
    setGenerationStatus('idle');
    setGenerationFeedback('Generating tool artifacts...');
    const finalDirective = formatSlug(toolDirective);

    try {
        const response = await fetch('/api/generate-tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toolDirective: finalDirective,
                generativeDescription: generativeDescription,
                additionalDescription: additionalDescription.trim(),
                modelName: selectedModel // Pass selected model
            }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || `Tool generation failed.`);
        }
        setGenerationStatus('success');
        setGenerationFeedback(data.message || 'Tool generation successful!');
        setPrUrl(data.prUrl || null);
    } catch (error: unknown) {
        console.error("Tool Generation Error:", error);
        setGenerationStatus('error');
        const message = error instanceof Error ? error.message : "Unexpected error.";
        setGenerationFeedback(`Generation Error: ${message}`);
        setPrUrl(null);
    } finally {
        setIsGenerating(false);
    }
  }; // End handleGenerate

  // --- JSX Structure (Unchanged functionally) ---
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Build a New Tool (Generate via AI)</h1>

      {/* --- Step 1 Area: Directive Input, Model Selection & Validation --- */}
      <div className={`mb-6 p-4 border rounded-lg bg-white shadow-sm ${validationStatus !== 'idle' ? 'opacity-75' : ''}`}>
        <h2 className="text-lg font-semibold mb-3">Step 1: Define, Select Model & Validate</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter a unique, descriptive, URL-friendly directive (e.g., `csv-to-json`). The AI will validate its suitability and suggest a description.
        </p>
        {/* Directive Input */}
        <div className="mb-4">
           <label htmlFor="toolDirective" className="block text-sm font-medium text-gray-700 mb-1">
            Tool Directive (URL Path) <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            id="toolDirective"
            name="toolDirective"
            required
            value={toolDirective}
            onChange={handleDirectiveChange}
            disabled={isValidating || isGenerating || validationStatus === 'success'}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm disabled:bg-gray-100"
            placeholder="e.g., markdown-formatter, base64-encoder"
          />
          <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, hyphens. Defines the tool's URL: `/t/{formatSlug(toolDirective) || '...'}`</p>
        </div>

        {/* Model Selection Dropdown */}
        <div className="mb-4">
            <label htmlFor="aiModelSelect" className="block text-sm font-medium text-gray-700 mb-1">
                Select AI Model for Validation: <span className="text-red-600">*</span>
            </label>
            {modelsLoading && <p className="text-sm text-gray-500">Loading models...</p>}
            {modelsError && <p className="text-sm text-red-600">Error loading models: {modelsError}</p>}
            {!modelsLoading && !modelsError && availableModels.length === 0 && (
                 <p className="text-sm text-orange-600">No compatible AI models found.</p>
            )}
            {!modelsLoading && !modelsError && availableModels.length > 0 && (
                <select
                    id="aiModelSelect"
                    name="aiModel"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isValidating || isGenerating || validationStatus === 'success'}
                    className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm disabled:bg-gray-100"
                >
                    {selectedModel === '' && <option value="" disabled>-- Select a Model --</option>}
                    {availableModels.map(model => (
                        <option key={model.name} value={model.name}>
                            {model.displayName} ({model.version}) - {model.name.replace('models/', '')}
                        </option>
                    ))}
                </select>
            )}
             <p className="mt-1 text-xs text-gray-500">Choose the AI model to use for understanding your directive.</p>
        </div>

        {/* Validate Button */}
        <button
          type="button"
          onClick={handleValidate}
          disabled={isValidating || isGenerating || !toolDirective.trim() || validationStatus === 'success' || modelsLoading || !selectedModel}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isValidating ? 'Validating...' : 'Validate Directive'}
        </button>

        {/* Validation Feedback */}
        {validationFeedback && validationStatus !== 'success' && (
           <div className={`mt-4 text-sm p-3 rounded ${validationStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
               {validationFeedback}
           </div>
        )}
      </div>

      {/* --- Step 2 Area: Review Description, Add Details & Generate --- */}
      {validationStatus === 'success' && (
        <div className="mt-6 mb-6 p-4 border-2 border-[#900027] rounded-lg bg-white shadow-md">
          <h2 className="text-lg font-semibold mb-3 text-[#7a0021]">Step 2: Review & Generate Artifacts</h2>
          {validationFeedback && (
              <p className="text-sm text-green-700 mb-4">{validationFeedback}</p>
          )}
          <div className="mb-4">
             <label htmlFor="generativeDescription" className="block text-sm font-medium text-gray-700 mb-1">
               AI Generated Description:
             </label>
             <textarea
                id="generativeDescription"
                readOnly
                value={generativeDescription || ''}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400 sm:text-sm resize-none"
             />
              <p className="mt-1 text-xs text-gray-500">This description was generated by the AI based on the directive.</p>
          </div>
          <div className="mb-4">
             <label htmlFor="additionalDescription" className="block text-sm font-medium text-gray-700 mb-1">
               Additional Details / Refinements (Optional):
             </label>
             <textarea
                id="additionalDescription"
                value={additionalDescription}
                onChange={handleAdditionalDescriptionChange}
                rows={4}
                disabled={isGenerating}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y disabled:bg-gray-100"
                placeholder="Add any specific details, edge cases, UI preferences, or refinements for the AI to consider during code generation..."
             />
              <p className="mt-1 text-xs text-gray-500">Provide extra context to help the AI generate better code.</p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isValidating}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#900027] hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate Tool Artifacts'}
          </button>
          {generationFeedback && (
            <div className={`mt-4 text-sm p-3 rounded ${generationStatus === 'error' ? 'bg-red-100 text-red-700' : generationStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {generationFeedback}
                {prUrl && generationStatus === 'success' && (
                   <p className="mt-2">
                    View the Pull Request: {' '}
                    <a href={prUrl} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
                        {prUrl}
                    </a>
                   </p>
                )}
            </div>
          )}
        </div>
      )}

      {/* Global Reset Button */}
      {(validationStatus !== 'idle' || generationStatus !== 'idle') && !isValidating && !isGenerating &&(
           <button
               type="button"
               onClick={() => { setToolDirective(''); resetFlow(); }}
               className="text-sm text-gray-600 hover:text-gray-900 hover:underline mt-4 block"
           >
               Start Over with New Directive
           </button>
       )}

    </div>
  );
}