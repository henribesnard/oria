import { useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ContextChips } from '../components/chat/ContextChips';
import type { ChatContext } from '../api/chat';

export function Chat() {
  const { messages, sending, context, setContext, send, handleSuggestedAction } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearContextKey = (key: keyof ChatContext) => {
    setContext(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="h-[60px] border-b border-border flex items-center px-7 shrink-0">
        <h1 className="text-[15px] font-bold text-text-strong">Nouvelle conversation</h1>
      </header>

      {/* Context chips */}
      <ContextChips context={context} onClear={clearContextKey} />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="max-w-[680px] mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center min-h-[50vh]">
              <div className="w-12 h-12 rounded-2xl bg-purple-surface flex items-center justify-center mb-4">
                <span className="font-serif text-xl text-primary">O</span>
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
