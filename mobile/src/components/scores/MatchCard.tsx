import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { PulseDot } from '@/src/components/ui/PulseDot';
import type { Fixture } from '@/src/api/catalog';

interface Props {
  fixture: Fixture;
  onPress?: (fixture: Fixture) => void;
  onContextPress?: (fixture: Fixture) => void;
}

const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

function isLive(status?: string) {
  return LIVE_STATUSES.includes((status ?? '').toUpperCase());
}

function clockText(fixture: Fixture) {
  const s = (fixture.status ?? '').toUpperCase();
  if (LIVE_STATUSES.includes(s)) {
    if (s === 'HT') return 'MT';
    return fixture.elapsed ? `${fixture.elapsed}'` : 'live';
  }
  try {
    const d = new Date(fixture.date);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (FINISHED_STATUSES.includes(s)) {
      if (isToday) return 'Fin';
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    // Upcoming
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return `${weekday} ${time}`;
  } catch {
    return '\u2014';
  }
}

export function MatchCard({ fixture, onPress, onContextPress }: Props) {
  const live = isLive(fixture.status);
  const clock = clockText(fixture);
  const hasScore = fixture.score_home != null && fixture.score_away != null;

  return (
    <Pressable
      style={[styles.card, live && styles.cardLive]}
      onPress={() => onPress?.(fixture)}
      onLongPress={onContextPress ? () => onContextPress(fixture) : undefined}
      delayLongPress={400}
    >
      {/* Home team */}
      <View style={styles.teamSide}>
        {fixture.home_logo ? (
          <View style={styles.logoWrap}>
            <Image source={{ uri: fixture.home_logo }} style={styles.logo} resizeMode="contain" />
          </View>
        ) : null}
        <Text style={styles.teamName} numberOfLines={1}>{fixture.home_team}</Text>
      </View>

      {/* Score / time center */}
      <View style={styles.center}>
        {hasScore ? (
          <Text style={styles.score}>{`${fixture.score_home}\u2013${fixture.score_away}`}</Text>
        ) : (
          <Text style={styles.time}>{clock}</Text>
        )}
        <View style={styles.clockRow}>
          {live && <PulseDot size={5} />}
          <Text style={[styles.clockText, live && styles.clockLive]}>
            {hasScore ? clock : ''}
          </Text>
        </View>
      </View>

      {/* Away team */}
      <View style={[styles.teamSide, { justifyContent: 'flex-end' }]}>
        <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>
          {fixture.away_team}
        </Text>
        {fixture.away_logo ? (
          <View style={styles.logoWrap}>
            <Image source={{ uri: fixture.away_logo }} style={styles.logo} resizeMode="contain" />
          </View>
        ) : null}
      </View>

      {/* Context action icon */}
      {onContextPress && (
        <Pressable
          style={styles.contextBtn}
          onPress={() => onContextPress(fixture)}
          hitSlop={6}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke={colors.textSubtle}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  cardLive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingHorizontal: 13,
    marginVertical: 2,
  },
  teamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  logoWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 18,
    height: 18,
  },
  teamName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    flexShrink: 1,
  },
  center: {
    alignItems: 'center',
    minWidth: 50,
  },
  score: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
    color: colors.text,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSubtle,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  clockText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSubtle,
  },
  clockLive: {
    color: colors.liveLight,
  },
  contextBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
