import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export interface MatchEvent {
  time: number | null;
  extra_time?: number | null;
  type: string;
  detail: string;
  team_id?: number;
  team_name?: string;
  player_name?: string;
  assist_name?: string | null;
}

interface Props {
  events: MatchEvent[];
  homeId?: number;
}

const EVENT_ICONS: Record<string, string> = {
  Goal: '\u26BD',
  Card: '\uD83D\uDFE8',
  subst: '\uD83D\uDD04',
  Var: '\uD83D\uDCFA',
};

function getIcon(type: string, detail: string): string {
  if (type === 'Goal') return '\u26BD';
  if (type === 'Card' && detail.toLowerCase().includes('red')) return '\uD83D\uDFE5';
  if (type === 'Card') return '\uD83D\uDFE8';
  if (type === 'subst') return '\uD83D\uDD04';
  if (type === 'Var') return '\uD83D\uDCFA';
  return '\u25CF';
}

export function EventTimeline({ events, homeId }: Props) {
  if (!events || events.length === 0) return null;

  const sorted = [...events].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

  return (
    <View style={styles.container}>
      {sorted.map((ev, i) => {
        const isHome = ev.team_id === homeId;
        const timeStr = ev.time != null
          ? ev.extra_time ? `${ev.time}+${ev.extra_time}'` : `${ev.time}'`
          : '';

        return (
          <View key={i} style={[styles.row, isHome ? styles.rowHome : styles.rowAway]}>
            {isHome && (
              <View style={styles.eventContent}>
                <Text style={styles.playerText} numberOfLines={1}>{ev.player_name ?? ''}</Text>
                {ev.assist_name && <Text style={styles.assistText}>{ev.assist_name}</Text>}
              </View>
            )}
            <View style={styles.center}>
              <Text style={styles.icon}>{getIcon(ev.type, ev.detail)}</Text>
              <Text style={styles.time}>{timeStr}</Text>
            </View>
            {!isHome && (
              <View style={[styles.eventContent, styles.eventContentAway]}>
                <Text style={styles.playerText} numberOfLines={1}>{ev.player_name ?? ''}</Text>
                {ev.assist_name && <Text style={styles.assistText}>{ev.assist_name}</Text>}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  rowHome: {
    justifyContent: 'flex-start',
  },
  rowAway: {
    justifyContent: 'flex-end',
  },
  center: {
    alignItems: 'center',
    width: 50,
    gap: 1,
  },
  icon: {
    fontSize: 14,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textDisabled,
  },
  eventContent: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  eventContentAway: {
    alignItems: 'flex-start',
    paddingRight: 0,
    paddingLeft: 6,
  },
  playerText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  assistText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textSubtle,
  },
});
