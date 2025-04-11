// /app/suggest-tool/page.tsx
'use client'; // Required for useState and event handlers

import React, { useState } from 'react';

export default function SuggestToolPage() {
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [toolUseCases, setToolUseCases] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // Optional: for loading state

  // --- Configuration for GitHub Link ---
  const githubUserOrOrg = 'Online-Everything-Tool'; // Replace with your actual username/org
  const githubRepo = 'oet'; // Replace with your actual repo name
  // --- End Configuration ---

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission
    setIsSubmitting(true); // Indicate processing

    // Basic validation (optional but recommended)
    if (!toolName.trim() || !toolDescription.trim()) {
        alert("Please fill out both Tool Name and Description.");
        setIsSubmitting(false);
        return;
    }

    // Construct the GitHub Issue URL
    const issueTitle = `New Tool Suggestion: ${toolName || 'Unnamed Tool'}`;
    const issueBody = `**Tool Name:**\n${toolName}\n\n**Description:**\n${toolDescription}\n\n**Use Cases:**\n${toolUseCases || 'N/A'}\n\n_[Submitted via OET Suggest Tool form]_`;
    const suggestIssueUrl = `https://github.com/${githubUserOrOrg}/${githubRepo}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

    // Redirect the user to GitHub to create the issue
    // In a real app, might show a brief "Redirecting..." message before this
    window.location.href = suggestIssueUrl;

    // If redirection fails or is blocked, reset submitting state after a delay
    setTimeout(() => setIsSubmitting(false), 3000);

    // If implementing Option B (API call) later, replace window.location.href
    // with your fetch() call.
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Suggest a New Tool</h1>
      <p className="text-gray-600 mb-6">
        Fill out the details below. Submitting this form will open a pre-filled
        issue template on GitHub where you can finalize and submit your suggestion.
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
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm"
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
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y"
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
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y"
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
            {isSubmitting ? 'Preparing...' : 'Prepare Suggestion on GitHub'}
          </button>
        </div>
      </form>
    </div>
  );
}