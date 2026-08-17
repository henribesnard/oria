import { useRef, useEffect, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ContextSelector } from '../components/chat/ContextSelector';
import OriaLogo from '../components/OriaLogo';
import { listLiveFixtures } from '../api/catalog';
import type { Fixture } from '../api/catalog';

/* ------------------------------------------------------------------ */
/*  Live ticker helpers                                                */
/* ------------------------------------------------------------------ */

function fixtureIsLive(status?: string): boolean {
  if (!status) return false;
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(status.toUpperCase());
}

function TickerCard({ fixture }: { fixture: Fixture }) {
  const isLive = fixtureIsLive(fixture.status);
  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white border border-border-inner shrink-0 text-[12px]">
      {isLive && (
        <span className="w-[6px] h-[6px] rounded-full bg-warning animate-[oria-pulse_1.5s_infinite] shrink-0" />
      )}
      <span className="font-semibold text-text-dark whitespace-nowrap">
        {fixture.home_team?.slice(0, 3).toUpperCase()}
      </span>
      <span className="font-mono font-bold text-text-strong">
        {fixture.score_home ?? 0} - {fixture.score_away ?? 0}
      </span>
      <span className="font-semibold text-text-dark whitespace-nowrap">
        {fixture.away_team?.slice(0, 3).toUpperCase()}
      </span>
      {fixture.elapsed && (
        <span className="text-[11px] text-warning-text font-semibold">{fixture.elapsed}'</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat page                                                          */
/* ------------------------------------------------------------------ */

export function Chat() {
  const {
    messages, sending, contextState,
    selectLeague, selectFixture, selectTeam, selectPlayer, clearContextLevel,
    send, handleSuggestedAction,
  } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [forcedLevel, setForcedLevel] = useState<number | null>(null);
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load live fixtures for ticker
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listLiveFixtures()
        .then((data) => { if (!cancelled) setLiveFixtures(data); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Handlers for panel coordination
  const handleOpenAtLevel = (level: number) => {
    setForcedLevel(level);
    setContextOpen(true);
  };

  const handleClosePanel = () => {
    setContextOpen(false);
    setForcedLevel(null);
  };

  const handleConfirm = () => {
    setContextOpen(false);
    setForcedLevel(null);
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="border-b border-border bg-surface/82 backdrop-blur-[10px] sticky top-0 z-20 shrink-0">
        <div className="max-w-[760px] mx-auto px-5 py-3.5 flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-[10px] bg-purple-surface border border-border-light flex items-center justify-center shrink-0">
            <OriaLogo size={25} />
          </div>
          <div className="flex flex-col gap-px min-w-0">
            <span className="font-serif text-[27px] leading-none tracking-[.2px]">Oria</span>
            <span className="text-xs text-text-muted tracking-[.3px]">L&apos;oracle du sport</span>
          </div>
          <div className="ml-auto flex items-center gap-[7px] px-3 py-1.5 border border-border-light bg-white rounded-full text-xs text-text-secondary font-semibold whitespace-nowrap">
            <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
            Football &middot; <span className="text-text-muted font-medium">bient&ocirc;t plus</span>
          </div>
        </div>
      </header>

      {/* Live ticker bar */}
      {liveFixtures.length > 0 && (
        <div className="border-b border-border-inner bg-surface-alt/80 px-5 py-2 overflow-hidden shrink-0">
          <div className="max-w-[760px] mx-auto flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <span className="flex items-center gap-1.5 shrink-0 mr-1">
              <span className="w-[6px] h-[6px] rounded-full bg-warning animate-[oria-pulse_1.5s_infinite]" />
              <span className="text-[11px] font-bold text-warning-text uppercase tracking-wider">Live</span>
            </span>
            {liveFixtures.map((f) => (
              <TickerCard key={f.id} fixture={f} />
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="max-w-[760px] mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center min-h-[50vh]">
              <div className="w-12 h-12 rounded-2xl bg-purple-surface border border-border-light flex items-center justify-center mb-4">
                <OriaLogo size={30} />
              </div>
              <h2 className="text-lg font-bold text-text-strong mb-2">
                Salut, comment puis-je t&apos;aider ?
              </h2>
              <p className="text-sm text-text-muted max-w-[360px]">
                Pose-moi une question sur un joueur, un match ou une &eacute;quipe.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onAction={handleSuggestedAction}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Overlay when panel is open */}
      {contextOpen && (
        <div
          onClick={handleClosePanel}
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(25,21,38,.06)' }}
        />
      )}

      {/* Footer: panel + composer */}
      <footer className="flex-none relative z-40 px-5 pt-2 pb-5">
        <div className="max-w-[760px] mx-auto relative">
          <ContextSelector
            contextState={contextState}
            onSelectLeague={selectLeague}
            onSelectFixture={selectFixture}
            onSelectTeam={selectTeam}
            onSelectPlayer={selectPlayer}
            onClearLevel={clearContextLevel}
            open={contextOpen}
            onClose={handleClosePanel}
            onConfirm={handleConfirm}
            initialForcedLevel={forcedLevel}
          />
          <ChatComposer
            onSend={send}
            disabled={sending}
            contextState={contextState}
            onClearLevel={clearContextLevel}
            onToggleContext={() => setContextOpen(o => !o)}
            contextOpen={contextOpen}
            onOpenAtLevel={handleOpenAtLevel}
          />
        </div>
      </footer>
    </div>
  );
}
