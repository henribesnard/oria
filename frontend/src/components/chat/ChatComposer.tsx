import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatComposer({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [disabled]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="border-t border-border px-7 py-4">
      <div className="max-w-[760px] mx-auto">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-surface-card border border-border rounded-2xl px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Posez votre question..."
            disabled={disabled}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="w-9 h-9 rounded-xl bg-primary hover:bg-primary-hover text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M8 3L3 8M8 3L13 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
