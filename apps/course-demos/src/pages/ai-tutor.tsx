// components/AITutor.tsx
import React, { useState, useEffect, useRef } from 'react';
import { NewText, CTALinkOrButton, ProgressDots } from '@bluedot/ui';
import { useCompletion } from '@ai-sdk/react';

type Msg = { role: 'user' | 'ai'; content: string };

export const AITutor: React.FC = () => {
  const [view, setView] = useState<'chat' | 'done'>('chat');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>(
    () => JSON.parse(localStorage.getItem('ai-tutor') ?? '[]') as Msg[],
  );

  const aiIndexRef = useRef<number | null>(null);

  /* ──────────────────────────  Streaming hook  ───────────────────────── */
  const {
    completion: aiReply,
    complete,
    isLoading: loading,
    error,
  } = useCompletion({
    api: '/api/tutor',
    onResponse: () => setView('chat'),
  });

  /* ───────── store chat so learner can resume after refresh ─────────── */
  useEffect(() => {
    localStorage.setItem('ai-tutor', JSON.stringify(msgs));
  }, [msgs]);

  /* ───────── keep scroll at bottom as messages arrive ───────────────── */
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  /* ───────── send user message & create AI placeholder ──────────────── */
  const send = () => {
    if (!input.trim()) return;

    const next = [...msgs, { role: 'user' as const, content: input.trim() }];
    setMsgs(next);
    setInput('');

    aiIndexRef.current = next.length; // position of AI reply
    setMsgs((prev) => [...prev, { role: 'ai', content: '' }]); // placeholder
    complete(JSON.stringify(next)); // start streaming
  };

  /* ───────── update placeholder with each streamed chunk ────────────── */
  useEffect(() => {
    if (aiReply == null || aiIndexRef.current == null) return;

    setMsgs((prev) => {
      const clone = [...prev];
      let text = aiReply;

      // Detect completion sentinel
      if (text.includes('__COMPLETE__')) {
        text = text.replace('__COMPLETE__', '').trim();
        setView('done'); // switch UI to banner
      }

      clone[aiIndexRef.current!] = { role: 'ai', content: text };
      return clone;
    });

    // Reset placeholder pointer once stream ends
    if (!loading) aiIndexRef.current = null;
  }, [aiReply, loading]);

  /* ───────── reset conversation completely ──────────────────────────── */
  const reset = () => {
    setMsgs([]);
    setInput('');
    setView('chat');
    aiIndexRef.current = null;
    localStorage.removeItem('ai-tutor');
  };

  /* ─────────────────────────── Render UI ────────────────────────────── */
  return (
    <main className="w-full px-4">
      <NewText.H2 className="mt-4 mb-2">AI Tutor</NewText.H2>

      {/* Chat history */}
      <div className="w-full border border-gray-400 rounded-lg shadow-md bg-white h-[60vh] overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-right' : ''}`}>
            <span
              className={`inline-block px-3 py-2 rounded whitespace-pre-wrap break-words ${
                m.role === 'user' ? 'bg-blue-100' : 'bg-stone-200'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}

        {loading && (
          <div className="text-left mb-2">
            <span className="inline-block px-3 py-2 rounded bg-stone-200">
              <ProgressDots />
            </span>
          </div>
        )}

        {error && (
          <div className="text-left mb-2">
            <span className="inline-block px-3 py-2 rounded bg-red-100">
              {error.message}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area or completion banner */}
      {view === 'chat' ? (
        <div className="relative flex mt-4">
          <textarea
            className="w-full p-4 border border-gray-400 rounded-lg shadow-md"
            rows={1}
            placeholder="Type your answer..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            disabled={loading}
          />
          <CTALinkOrButton
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            {loading ? 'Thinking…' : 'Send'}
          </CTALinkOrButton>
        </div>
      ) : (
        <NewText.P className="text-green-600 font-medium mt-4">
          ✅ Exercise complete!
        </NewText.P>
      )}

      <CTALinkOrButton
        variant="secondary"
        className="mt-4"
        onClick={reset}
      >
        Reset conversation
      </CTALinkOrButton>
    </main>
  );
};
