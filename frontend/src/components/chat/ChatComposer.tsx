import { useState, useRef, useEffect, useCallback } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  onToggleContext?: () => void;
  contextOpen?: boolean;
}

export function ChatComposer({ onSend, disabled, onToggleContext, contextOpen }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [disabled]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border px-7 py-4">
      <div className="max-w-[760px] mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end gap-3 bg-surface-card border border-border rounded-2xl px-4 py-3">
          {/* Context toggle button */}
          {onToggleContext && (
            <button
              type="button"
              onClick={onToggleContext}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                contextOpen
                  ? 'bg-primary text-white'
                  : 'bg-surface-muted text-text-muted hover:bg-purple-surface hover:text-primary'
              }`}
              title="Contexte"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pose ta question \u00e0 Oria\u2026"
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none disabled:opacity-50 resize-none leading-relaxed"
            style={{ maxHeight: 160 }}
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="w-9 h-9 rounded-xl bg-primary hover:bg-primary-hover text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
