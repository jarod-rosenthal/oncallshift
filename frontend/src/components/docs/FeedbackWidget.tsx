import { useState } from 'react';

interface FeedbackWidgetProps {
  pageId?: string;
}

export function FeedbackWidget({ pageId }: FeedbackWidgetProps) {
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  const handleFeedback = (value: 'yes' | 'no') => {
    setFeedback(value);
    setSubmitted(true);
    // In a real implementation, you would send this to your analytics/feedback endpoint
    console.log('Feedback submitted:', { pageId, helpful: value === 'yes' });
  };

  if (submitted) {
    return (
      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
        <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <p className="text-slate-600 dark:text-slate-400">
            {feedback === 'yes' ? (
              <>Thanks for your feedback!</>
            ) : (
              <>Thanks for letting us know. We&apos;ll work on improving this page.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          Was this page helpful?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleFeedback('yes')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-green-300 dark:hover:border-green-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            Yes
          </button>
          <button
            onClick={() => handleFeedback('no')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
            No
          </button>
        </div>
      </div>
    </div>
  );
}
