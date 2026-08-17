import { useState, useRef, useEffect, useCallback } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { ContextState, Level } from '../../lib/contextRules';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  contextState: ContextState;
  onClearLevel: (level: Exclude<Level, 'none'>) => void;
  onToggleContext: () => void;
  contextOpen: boolean;
  onOpenAtLevel: (panelLevel: number) => void;
}

/* ------------------------------------------------------------------ */
/*  ChatComposer                                                       */
/* ------------------------------------------------------------------ */

export function ChatComposer({
  onSend,
  disabled,
  contextState,
  onClearLevel,
  onToggleContext,
  contextOpen,
  onOpenAtLevel,
}: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [disabled]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
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

  // Build chip parts from context labels
  const { labels } = contextState;
  const chipParts: { label: string; logo?: string; level: Exclude<Level, 'none'>; panelLevel: number }[] = [];
  if (labels.league) chipParts.push({ label: labels.league.name, logo: labels.league.logo, level: 'league', panelLevel: 1 });
  if (labels.fixture) chipParts.push({ label: `${labels.fixture.home} – ${labels.fixture.away}`, level: 'fixture', panelLevel: 2 });
  if (labels.team) chipParts.push({ label: labels.team.name, logo: labels.team.logo, level: 'team', panelLevel: 2 });
  if (labels.player) chipParts.push({ label: labels.player.name, level: 'player', panelLevel: 3 });
  const hasContext = chipParts.length > 0;

  return (
    <>
      {/* Composer card */}
      <div
        className="bg-white rounded-[20px] p-2.5 transition-[border-color] duration-150"
        style={{
          border: `1px solid ${contextOpen ? '#C9C3EC' : '#E9E7F2'}`,
          boxShadow: '0 8px 28px -10px rgba(38,32,74,.14)',
        }}
      >
        {/* Context chips row */}
        {hasContext && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pt-0.5 pb-2.5">
            <span className="text-[11px] font-bold tracking-[.4px] uppercase text-text-disabled mr-0.5">
              Contexte
            </span>
            {chipParts.map(chip => (
              <span
                key={chip.level}
                className="inline-flex items-center gap-1.5 py-[5px] pl-2 pr-[5px] rounded-full"
                style={{ background: '#EEEDFA', border: '1px solid #DED9FA' }}
              >
                {chip.logo && (
                  <span className="relative w-[18px] h-[18px] rounded-[5px] bg-white border border-border-inner overflow-hidden flex items-center justify-center shrink-0">
                    <img src={chip.logo} alt="" className="w-full h-full object-contain" />
                  </span>
                )}
                <button
                  onClick={() => onOpenAtLevel(chip.panelLevel)}
                  className="text-[12.5px] font-semibold whitespace-nowrap"
                  style={{ color: '#4A3FC0' }}
                >
                  {chip.label}
                </button>
                <button
                  onClick={() => onClearLevel(chip.level)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs transition-colors hover:bg-purple-border"
                  style={{ color: '#4A3FC0' }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input row */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={onToggleContext}
            className="shrink-0 h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl border text-[13.5px] font-semibold transition-all duration-150"
            style={{
              borderColor: contextOpen ? '#C9C3EC' : '#E9E7F2',
              background: contextOpen ? '#EEEDFA' : '#fff',
              color: contextOpen ? '#4A3FC0' : '#86829A',
            }}
          >
            <span className="text-base font-medium leading-none">
              {hasContext ? '⇅' : '＋'}
            </span>
            Contexte
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pose ta question à Oria…"
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-[15px] text-text placeholder:text-text-faint focus:outline-none disabled:opacity-50 resize-none leading-relaxed py-2.5 px-1 min-w-0"
            style={{ maxHeight: 150 }}
          />

          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:cursor-not-allowed"
            style={{
              background: text.trim() ? '#5B4FD6' : '#E9E7F2',
              color: text.trim() ? '#fff' : '#B4AFCA',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>

      {/* Hint text */}
      <p className="text-[11.5px] text-text-disabled text-center mt-2.5 leading-snug">
        Le contexte reste actif pour toute la conversation &mdash; clique une puce pour la modifier, la croix pour l&apos;oublier.
      </p>
    </>
  );
}
