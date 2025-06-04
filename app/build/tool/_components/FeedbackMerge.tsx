// FILE: app/build/tool/_components/FeedbackMerge.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import Button from '@/app/tool/_components/form/Button';
import Textarea from '@/app/tool/_components/form/Textarea';
import EmojiExplorerModal from '@/app/tool/_components/shared/EmojiExplorerModal';
import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftEllipsisIcon,
  UserCircleIcon,
  PaperAirplaneIcon,
  ExclamationCircleIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/20/solid';

export interface PrCommentAuthor {
  login: string;
  avatarUrl: string;
  isBot: boolean;
  isOetAppCommenter?: boolean;
}
export interface PrCommentData {
  id: number | string;
  author: PrCommentAuthor | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  isOetFormattedFeedback?: boolean;
  feedbackEmoji?: string;
  feedbackText?: string;
}

interface FeedbackMergeProps {
  prNumber: number;
  prUrl: string;
  toolName: string;
  netlifyPreviewUrl: string;
  onHideFeedback: () => void;
}

export default function FeedbackMerge({
  prNumber,
  prUrl,
  toolName,
  netlifyPreviewUrl,
  onHideFeedback,
}: FeedbackMergeProps) {
  const [selectedEmoji, setSelectedEmoji] = useState('💬');
  const [commentText, setCommentText] = useState('');
  const [feedbackList, setFeedbackList] = useState<PrCommentData[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingSuccess, setIsSubmittingSuccess] = useState(false);

  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
  const [fetchFeedbackError, setFetchFeedbackError] = useState<string | null>(
    null
  );

  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setIsLoadingFeedback(true);
    setFetchFeedbackError(null);
    try {
      const response = await fetch(`/api/pr-comments?prNumber=${prNumber}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to fetch feedback (${response.status})`
        );
      }
      const data = await response.json();
      setFeedbackList(data.comments || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      setFetchFeedbackError(error.message || 'Could not load feedback.');
      setFeedbackList([]);
    } finally {
      setIsLoadingFeedback(false);
    }
  }, [prNumber]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleEmojiSelectFromModal = (emoji: string) => {
    setSelectedEmoji(emoji);
    setIsEmojiModalOpen(false);
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      setSubmitError('Comment text cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setIsSubmittingSuccess(false);

    try {
      const response = await fetch('/api/pr-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prNumber,
          emoji: selectedEmoji,
          commentText: commentText.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Failed to submit comment (${response.status})`
        );
      }

      if (data.comment) {
        setFeedbackList((prev) => [data.comment, ...prev]);
      } else {
        fetchFeedback();
      }
      setCommentText('');
      setIsSubmittingSuccess(true);
      setTimeout(() => setIsSubmittingSuccess(false), 3000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setSubmitError(error.message || 'Could not submit comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFeedbackItem = (fb: PrCommentData) => {
    const authorName = fb.author?.login || 'Unknown User';
    const authorAvatar = fb.author?.avatarUrl;
    const displayDate = new Date(fb.createdAt).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    if (fb.isOetFormattedFeedback && fb.feedbackEmoji && fb.feedbackText) {
      return (
        <div className="flex items-start space-x-2">
          <span className="text-xl mt-0.5" aria-label="Feedback emoji">
            {fb.feedbackEmoji}
          </span>
          <div className="flex-grow">
            <p className="text-gray-700 whitespace-pre-wrap">
              {fb.feedbackText}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              Posted by{' '}
              {fb.author?.isOetAppCommenter ? 'OET System' : authorName} on{' '}
              {displayDate}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start space-x-3">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt={authorName}
            className="h-8 w-8 rounded-full mt-0.5 border border-gray-200"
          />
        ) : (
          <UserCircleIcon className="h-8 w-8 text-gray-400 mt-0.5" />
        )}
        <div className="flex-grow">
          <p className="text-gray-600 text-xs">
            <Link
              href={fb.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:underline"
            >
              {authorName}
            </Link>
            {' commented on '}
            {displayDate}
          </p>
          <div className="prose prose-sm max-w-none text-gray-800 mt-1 text-sm whitespace-pre-wrap">
            {fb.body}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 p-4 md:p-6 border-2 border-[#16a34a] bg-white rounded-lg shadow-lg relative">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h3 className="text-xl font-semibold">
          Feedback & Discussion for:{' '}
          <span className="font-bold">{toolName}</span>
        </h3>
        <Button
          variant="neutral-outline"
          size="sm"
          onClick={onHideFeedback}
          iconLeft={<ArrowUturnLeftIcon className="h-4 w-4 text-gray-600" />}
          className="border-gray-400 text-gray-600 hover:bg-gray-100"
        >
          Back to CI Status
        </Button>
      </div>

      <div className="mb-6 p-3 border border-blue-200 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-700">
          Review the tool here:
          <Link
            href={netlifyPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline ml-1"
          >
            Open Preview{' '}
            <ArrowTopRightOnSquareIcon className="ml-1 h-3.5 w-3.5 inline" />
          </Link>
        </p>
      </div>

      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
          <ChatBubbleLeftEllipsisIcon className="h-5 w-5 mr-2 text-gray-500" />
          Discussion & Feedback on GitHub PR #{prNumber}:
        </h4>
        {isLoadingFeedback && (
          <p className="text-xs text-gray-500 italic py-4 text-center">
            Loading feedback...
          </p>
        )}
        {fetchFeedbackError && (
          <p className="text-xs text-red-500 py-4 text-center">
            Error: {fetchFeedbackError}
          </p>
        )}
        {!isLoadingFeedback &&
          !fetchFeedbackError &&
          feedbackList.length === 0 && (
            <p className="text-xs text-gray-500 italic py-4 text-center">
              No user feedback comments yet on this Pull Request.
            </p>
          )}
        {feedbackList.length > 0 && (
          <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar p-3 bg-white shadow-sm">
            {feedbackList.map((fb) => (
              <div
                key={fb.id}
                className="text-sm border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
              >
                {renderFeedbackItem(fb)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-2">
        <h4 className="text-md font-semibold text-gray-700 mb-2">
          Provide Feedback (posts as a comment on PR #{prNumber}):
        </h4>
        <form
          onSubmit={handleCommentSubmit}
          className="space-y-3 p-3 border border-gray-200 rounded-md bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsEmojiModalOpen(true)}
              variant="neutral-outline"
              className="!px-3 !py-2 text-2xl leading-none !border-gray-400 hover:!bg-gray-100"
              title="Select Feedback Emoji"
              aria-label="Select Feedback Emoji"
            >
              <span className="text-2xl">{selectedEmoji}</span>
            </Button>
            <Textarea
              id={`pr-${prNumber}-feedback-comment`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="How is the tool? Any issues or suggestions? (Max 280 chars)"
              rows={2}
              maxLength={280}
              disabled={isSubmitting}
              containerClassName="flex-grow"
              textareaClassName="text-sm leading-relaxed"
            />
          </div>
          <div className="flex justify-end items-center gap-3">
            {submitError && (
              <p className="text-xs text-red-600 mr-auto flex items-center">
                <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                {submitError}
              </p>
            )}
            {isSubmittingSuccess && !submitError && (
              <p className="text-xs text-green-600 mr-auto">
                Feedback submitted to PR!
              </p>
            )}
            <Button
              type="submit"
              variant="secondary"
              isLoading={isSubmitting}
              loadingText="Posting..."
              iconLeft={
                <PaperAirplaneIcon className="h-4 w-4 transform -rotate-45" />
              }
            >
              Add Feedback to PR
            </Button>
          </div>
        </form>
      </div>

      <div className="flex flex-row items-center justify-center gap-3 p-3">
        <Button
          variant="primary"
          disabled={true}
          title="Maintainer action: Requires GitHub login and organization membership."
          iconLeft={<span>🚀</span>}
        >
          Merge Tool
        </Button>
        <p className="text-sm text-gray-900">
          The &ldquo;Merge Tool&rdquo; button is for{' '}
          <Link
            href="https://github.com/Online-Everything-Tool/oet/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            project maintainers
          </Link>
          .
        </p>
      </div>

      <div className="pt-4 text-center">
        <p className="text-sm text-gray-600 mb-3">
          For more detailed technical discussion, bug tracking, or if you are a
          contributor:
          <Link
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline ml-1"
          >
            View Full Pull Request on GitHub{' '}
            <ArrowTopRightOnSquareIcon className="ml-1 h-3.5 w-3.5 inline" />
          </Link>
        </p>
      </div>

      <EmojiExplorerModal
        isOpen={isEmojiModalOpen}
        onClose={() => setIsEmojiModalOpen(false)}
        outputMode="select"
        onEmojiSelectedForForm={handleEmojiSelectFromModal}
      />
    </div>
  );
}
