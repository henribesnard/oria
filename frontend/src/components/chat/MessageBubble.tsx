import type { Message } from '../../hooks/useChat';
import type { SuggestedAction, Attachment } from '../../api/chat';
import type { Fixture } from '../../api/catalog';
import { FixtureCard } from '../follows/FixtureCard';
import OriaLogo from '../OriaLogo';

/* ------------------------------------------------------------------ */
/*  Raw API fixture → flat Fixture interface                          */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeFixture(raw: Record<string, any>): Fixture {
  // Already in flat format (from catalog endpoint)
  if (typeof raw.home_team === 'string') return raw as unknown as Fixture;

  // Nested API Football format
  const home = raw.home ?? raw.teams?.home ?? {};
  const away = raw.away ?? raw.teams?.away ?? {};
  const league = raw.league ?? {};
  const status = raw.status ?? {};
  const goals = raw.goals ?? {};
  const venue = raw.venue ?? {};

  return {
    id: raw.id ?? raw.fixture?.id ?? 0,
    date: raw.date ?? raw.fixture?.date ?? '',
    timestamp: raw.timestamp ?? raw.fixture?.timestamp,
    home_team: home.name ?? '',
    home_id: home.id,
    home_logo: home.logo,
    away_team: away.name ?? '',
    away_id: away.id,
    away_logo: away.logo,
    score_home: goals.home ?? raw.goals_home ?? null,
    score_away: goals.away ?? raw.goals_away ?? null,
    status: status.short ?? raw.status_short ?? '',
    status_long: status.long ?? '',
    elapsed: status.elapsed,
    league_id: league.id,
    league_name: league.name ?? '',
    league_logo: league.logo,
    league_country: league.country,
    league_flag: league.flag,
    round: league.round ?? raw.round,
    venue: typeof venue === 'object' ? venue : {},
    referee: raw.referee,
  };
}

function extractFixtures(att: Attachment): Fixture[] {
  const data = att.data as Record<string, unknown>;

  // { fixtures: [...] }
  if (Array.isArray(data.fixtures)) {
    return (data.fixtures as Record<string, unknown>[]).map(normalizeFixture);
  }

  // { fixture: {...} }  (single)
  if (data.fixture && typeof data.fixture === 'object' && !Array.isArray(data.fixture)) {
    return [normalizeFixture(data.fixture as Record<string, unknown>)];
  }

  // Direct fixture object (has id, date, etc.)
  if (data.id || data.home_team || data.home) {
    return [normalizeFixture(data)];
  }

  return [];
}

/* ------------------------------------------------------------------ */
/*  Attachment renderer                                                */
/* ------------------------------------------------------------------ */

function AttachmentBlock({ att }: { att: Attachment }) {
  if (att.kind === 'fixture_card') {
    const fixtures = extractFixtures(att);
    if (fixtures.length > 0) {
      return (
        <div className="flex flex-col gap-2">
          {fixtures.map((f, i) => (
            <FixtureCard key={f.id || i} fixture={f} />
          ))}
        </div>
      );
    }
  }

  // Fallback for other kinds or unparseable data
  return (
    <div className="bg-surface-card border border-border rounded-xl p-3 text-xs text-text-secondary">
      <span className="inline-block px-2 py-0.5 rounded-md bg-purple-surface text-primary text-[11px] font-semibold mb-1">
        {att.kind}
      </span>
      <pre className="font-mono text-[11px] text-text-muted mt-1 whitespace-pre-wrap">
        {JSON.stringify(att.data, null, 2)}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

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
            <OriaLogo size={21} />
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
                <AttachmentBlock key={i} att={att} />
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
