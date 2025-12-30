'use client';

import { useState } from 'react';

interface FeedbackPanelProps {
  sessionId: string;
  onSubmit?: (feedback: string) => Promise<void>;
}

export default function FeedbackPanel({ sessionId, onSubmit }: FeedbackPanelProps) {
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSend = async () => {
    if (!feedback.trim()) return;

    setStatus('sending');

    try {
      if (onSubmit) {
        await onSubmit(feedback);
      } else {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, feedback }),
        });

        if (!res.ok) {
          throw new Error('Failed to send feedback');
        }
      }

      setStatus('sent');
      setTimeout(() => {
        setStatus('idle');
        setFeedback('');
      }, 3000);
    } catch (error) {
      console.error('Error sending feedback:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Tell Claude what to change..."
        className="flex-1 min-h-[80px] resize-none rounded-lg border border-gray-200 p-3 text-[13px] font-[inherit] focus:outline-none focus:border-gray-400"
      />

      <div className="mt-2">
        <button
          onClick={handleSend}
          disabled={!feedback.trim() || status === 'sending'}
          className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors ${
            status === 'sent'
              ? 'bg-green-600 text-white'
              : status === 'error'
                ? 'bg-red-600 text-white'
                : feedback.trim()
                  ? 'bg-gray-900 text-white hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 1L8 8M15 1l-5 14-3-6-6-3 14-5z" />
          </svg>
          {status === 'sending'
            ? 'Sending...'
            : status === 'sent'
              ? 'Sent to Claude!'
              : status === 'error'
                ? 'Error - Try Again'
                : 'Send to Claude'}
        </button>
      </div>

      {status === 'sent' && (
        <p className="mt-2 text-center text-[11px] text-green-600">
          Claude can now read your feedback
        </p>
      )}
    </div>
  );
}
