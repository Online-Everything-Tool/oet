// /app/suggest-tool/page.tsx
'use client'; // Required for useState and event handlers

import React, { useState } from 'react';

export default function SuggestToolPage() {
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [toolUseCases, setToolUseCases] = useState('');

  // State for submission status and feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null); // To store the PR URL on success

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission
    setIsSubmitting(true);
    setSubmitStatus('idle'); // Reset status on new submission
    setFeedbackMessage(null);
    setPrUrl(null);

    // Basic validation
    if (!toolName.trim() || !toolDescription.trim()) {
      setSubmitStatus('error');
      setFeedbackMessage("Please fill out both Tool Name and Description.");
      setIsSubmitting(false);
      return;
    }

    try {
      // --- KEY: Sending data to the backend API endpoint ---
      const response = await fetch('/api/create-anonymous-pr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName,
          toolDescription,
          toolUseCases,
        }),
      });
      // --- End Key Section ---

      const data = await response.json();

      if (!response.ok) {
        // Handle API errors (e.g., 4xx, 5xx)
        console.error("API Error Response:", data);
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      // Handle success
      console.log("API Success Response:", data);
      setSubmitStatus('success');
      setFeedbackMessage(data.message || 'Suggestion submitted successfully!');
      setPrUrl(data.url || null); // Store the PR URL from the response

    } catch (error: unknown) { // Use unknown
      console.error("Frontend Submission Error:", error);
      setSubmitStatus('error');
      // Safer message extraction
      const message = error instanceof Error ? error.message : "An unexpected error occurred during submission.";
      setFeedbackMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Suggest a New Tool</h1>

      {/* Conditionally render Form or Feedback Message */}
      {submitStatus !== 'success' ? (
        <>
          <p className="text-gray-600 mb-6">
            Fill out the details below to suggest a new client-side tool.
            Your suggestion will be submitted anonymously as a Pull Request on GitHub.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tool Name Field */}
            <div>
              <label htmlFor="toolName" className="block text-sm font-medium text-gray-700 mb-1">
                Tool Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="toolName"
                name="toolName"
                required
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                disabled={isSubmitting} // Disable during submission
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm disabled:bg-gray-100"
                placeholder="e.g., CSV Parser, Image Resizer"
              />
              <p className="mt-1 text-xs text-gray-500">A clear and concise name for the tool.</p>
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="toolDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-600">*</span>
              </label>
              <textarea
                id="toolDescription"
                name="toolDescription"
                rows={4}
                required
                value={toolDescription}
                onChange={(e) => setToolDescription(e.target.value)}
                disabled={isSubmitting} // Disable during submission
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y disabled:bg-gray-100"
                placeholder="Describe what the tool does and its main purpose."
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">Explain the core functionality.</p>
            </div>

            {/* Use Cases Field */}
            <div>
              <label htmlFor="toolUseCases" className="block text-sm font-medium text-gray-700 mb-1">
                Use Cases / Examples (Optional)
              </label>
              <textarea
                id="toolUseCases"
                name="toolUseCases"
                rows={3}
                value={toolUseCases}
                onChange={(e) => setToolUseCases(e.target.value)}
                disabled={isSubmitting} // Disable during submission
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y disabled:bg-gray-100"
                placeholder="How would this tool be useful? Provide examples if possible."
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">Help us understand why this tool is needed.</p>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting} // Disable button while processing
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#900027] hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Suggestion as PR'}
              </button>
            </div>

             {/* Error Message Area */}
             {submitStatus === 'error' && feedbackMessage && (
                <p className="mt-4 text-sm text-red-600" role="alert">
                    Error: {feedbackMessage}
                </p>
             )}
          </form>
        </>
      ) : (
        // Success Message Area
        <div className="p-4 border rounded-lg bg-green-50 border-green-300 text-green-800" role="alert">
          <h3 className="text-lg font-semibold mb-2">Success!</h3>
          <p className="mb-3">{feedbackMessage || 'Your suggestion has been submitted.'}</p>
          {prUrl && (
            <p>
              You can view the generated Pull Request here: {' '}
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-green-900 hover:underline"
              >
                {prUrl}
              </a>
            </p>
          )}
          <button
            onClick={() => {
                setSubmitStatus('idle'); // Reset to allow another submission
                setFeedbackMessage(null);
                setPrUrl(null);
                // Clear form
                setToolName('');
                setToolDescription('');
                setToolUseCases('');
            }}
            className="mt-4 inline-flex justify-center py-1 px-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#900027] hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027]"
          >
            Suggest Another Tool
          </button>
        </div>
      )}
    </div>
  );
}