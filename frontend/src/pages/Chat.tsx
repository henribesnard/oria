import { useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ContextSelector } from '../components/chat/ContextSelector';
import OriaLogo from '../components/OriaLogo';

export function Chat() {
  const { messages, sending, context, setContext, send, handleSuggestedAction, fixtureInfo, clearFixture } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            <span className="text-xs text-text-muted tracking-[.3px]">L'oracle du sport</span>
          </div>
          <div className="ml-auto flex items-center gap-[7px] px-3 py-1.5 border border-border-light bg-white rounded-full text-xs text-text-secondary font-semibold whitespace-nowrap">
            <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
            Football · <span className="text-text-muted font-medium">bientôt plus</span>
          </div>
        </div>
      </header>

      {/* Context selector */}
      <div className="border-b border-border bg-surface-alt/60 px-5 py-2.5">
        <div className="max-w-[760px] mx-auto">
          <ContextSelector context={context} onChange={setContext} fixtureInfo={fixtureInfo} onClearFixture={clearFixture} />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="max-w-[760px] mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center min-h-[50vh]">
              <div className="w-12 h-12 rounded-2xl bg-purple-surface border border-border-light flex items-center justify-center mb-4">
                <OriaLogo size={30} />
              </div>
              <h2 className="text-lg font-bold text-text-strong mb-2">
                Bonjour, comment puis-je vous aider ?
              </h2>
              <p className="text-sm text-text-muted max-w-[360px]">
                Posez-moi une question sur un joueur, un match ou une équipe.
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

      {/* Composer */}
      <ChatComposer onSend={send} disabled={sending} />
    </div>
  );
}
