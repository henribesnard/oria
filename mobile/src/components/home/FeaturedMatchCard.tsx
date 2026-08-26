import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { PulseDot } from '@/src/components/ui/PulseDot';
import type { Fixture } from '@/src/api/catalog';

interface Props {
  fixture: Fixture;
  onPress: () => void;
  onContextPress?: () => void;
}

export function FeaturedMatchCard({ fixture, onPress, onContextPress }: Props) {
  const live = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(
    (fixture.status ?? '').toUpperCase(),
  );
  const hasScore = fixture.score_home != null && fixture.score_away != null;
  const clock = live
    ? (fixture.elapsed ? `${fixture.elapsed}'` : 'EN DIRECT')
    : hasScore
      ? 'TERMIN\u00C9'
      : (() => { try { return new Date(fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return '\u2014'; } })();

  const leagueLabel = [
    fixture.league_country ? fixture.league_country.toUpperCase() : '',
    (fixture.league_name ?? '').toUpperCase(),
  ].filter(Boolean).join(' \u00B7 ');

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Context action button */}
      {onContextPress && (
        <Pressable style={styles.contextBtn} onPress={onContextPress} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke={colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      )}

      {/* League badge */}
      <View style={styles.leagueRow}>
        {fixture.league_logo ? (
          <View style={styles.leagueLogoWrap}>
            <Image source={{ uri: fixture.league_logo }} style={styles.leagueLogo} resizeMode="contain" />
          </View>
        ) : null}
        <Text style={styles.leagueTag}>
          {leagueLabel}
          {fixture.round ? ` \u00B7 ${fixture.round}` : ''}
        </Text>
      </View>

      {/* Teams + Score */}
      <View style={styles.matchRow}>
        <View style={styles.teamCol}>
          {fixture.home_logo ? (
            <View style={styles.teamLogoWrap}>
              <Image source={{ uri: fixture.home_logo }} style={styles.teamLogo} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.teamName} numberOfLines={2}>{fixture.home_team}</Text>
        </View>

        <View style={styles.scoreCol}>
          <Text style={styles.score}>
            {hasScore ? `${fixture.score_home}\u2013${fixture.score_away}` : '\u2013 \u2013'}
          </Text>
          <View style={styles.clockRow}>
            {live && <PulseDot size={6} />}
            <Text style={[styles.clockText, live && styles.clockLive]}>{clock}</Text>
          </View>
        </View>

        <View style={styles.teamCol}>
          {fixture.away_logo ? (
            <View style={styles.teamLogoWrap}>
              <Image source={{ uri: fixture.away_logo }} style={styles.teamLogo} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.teamName} numberOfLines={2}>{fixture.away_team}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 24,
    padding: 20,
    gap: 18,
  },
  contextBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 36,
  },
  leagueLogoWrap: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueLogo: {
    width: 15,
    height: 15,
  },
  leagueTag: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    flex: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCol: {
    alignItems: 'center',
    gap: 9,
    width: 92,
  },
  teamLogoWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  teamLogo: {
    width: 40,
    height: 40,
  },
  teamName: {
    fontFamily: fonts.sansBold,
    fontSize: 12.5,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  scoreCol: {
    alignItems: 'center',
    gap: 6,
  },
  score: {
    fontFamily: fonts.mono,
    fontSize: 40,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  clockText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSubtle,
    letterSpacing: 0.5,
  },
  clockLive: {
    color: colors.liveLight,
  },
});
