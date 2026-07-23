import type { Message } from '../../hooks/useChat';
import type { SuggestedAction } from '../../api/chat';
import OriaLogo from '../OriaLogo';

interface Props {
  message: Message;
  onAction?: (action: SuggestedAction) => void;
}

export function MessageBubble({ message, onAction }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-[oria-msg-in_0.25s_ease-out]`}>
      <div className={`max-w-[85%] ${isUser ? '' : 'flex gap-3'}`}>
        {/* Avatar for assistant */}
        {!isUser && (
          <div className="w-[30px] h-[30px] rounded-lg bg-purple-surface border border-border-light flex items-center justify-center shrink-0 mt-0.5">
            <OriaLogo size={21} centerFill="#EEEDFA" />
          </div>
        )}
        <div>
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? 'bg-primary text-white rounded-br-lg'
                : 'bg-surface-card border border-border rounded-bl-lg'
            } ${message.degraded ? 'opacity-70' : ''}`}
          >
            {message.text || (message.streaming && (
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-muted animate-[oria-blink_1.4s_infinite_0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary-muted animate-[oria-blink_1.4s_infinite_200ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary-muted animate-[oria-blink_1.4s_infinite_400ms]" />
              </span>
            ))}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {message.attachments.map((att, i) => (
                <div key={i} className="bg-surface-card border border-border rounded-xl p-3 text-xs text-text-secondary">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-purple-surface text-primary text-[11px] font-semibold mb-1">
                    {att.kind}
                  </span>
                  <pre className="font-mono text-[11px] text-text-muted mt-1 whitespace-pre-wrap">
                    {JSON.stringify(att.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Suggested actions */}
          {message.suggested_actions && message.suggested_actions.length > 0 && !message.streaming && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.suggested_actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onAction?.(action)}
                  className="px-3 py-1.5 rounded-xl border border-purple-border bg-purple-surface text-primary text-xs font-semibold hover:bg-purple-hover transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
