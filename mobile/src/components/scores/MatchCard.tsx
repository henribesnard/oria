import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import type { Fixture } from '@/src/api/catalog';

interface Props {
  fixture: Fixture;
  onPress?: (fixture: Fixture) => void;
}

function statusMeta(status?: string) {
  const s = status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s))
    return { fg: colors.warningDark, bg: colors.warningLight, label: 'live' };
  if (['FT', 'AET', 'PEN'].includes(s))
    return { fg: colors.textMuted, bg: colors.surfaceMuted, label: 'fin' };
  return { fg: colors.primaryHover, bg: colors.primarySurface, label: 'à venir' };
}

function clockText(fixture: Fixture) {
  const s = fixture.status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s)) {
    return fixture.elapsed ? `${fixture.elapsed}'` : 'live';
  }
  if (['FT', 'AET', 'PEN'].includes(s)) return 'Fin';
  // upcoming: show time
  try {
    const d = new Date(fixture.date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export function MatchCard({ fixture, onPress }: Props) {
  const meta = statusMeta(fixture.status);
  const clock = clockText(fixture);
  const hasScore = fixture.score_home != null && fixture.score_away != null;

  return (
    <Pressable style={styles.card} onPress={() => onPress?.(fixture)}>
      {/* Home */}
      <View style={styles.teamSide}>
        {fixture.home_logo ? (
          <Image source={{ uri: fixture.home_logo }} style={styles.logo} resizeMode="contain" />
        ) : null}
        <Text style={styles.teamName} numberOfLines={1}>{fixture.home_team}</Text>
      </View>

      {/* Score */}
      <Text style={[styles.score, { color: meta.label === 'live' ? colors.text : colors.textSecondary }]}>
        {hasScore ? `${fixture.score_home}–${fixture.score_away}` : '—'}
      </Text>

      {/* Away */}
      <View style={[styles.teamSide, { justifyContent: 'flex-end' }]}>
        <Text style={styles.teamName} numberOfLines={1}>{fixture.away_team}</Text>
        {fixture.away_logo ? (
          <Image source={{ uri: fixture.away_logo }} style={styles.logo} resizeMode="contain" />
        ) : null}
      </View>

      {/* Clock badge */}
      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
        <Text style={[styles.badgeText, { color: meta.fg }]}>{clock}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  teamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  logo: {
    width: 20,
    height: 20,
  },
  teamName: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.textDark,
    flexShrink: 1,
  },
  score: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 38,
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
  },
});
