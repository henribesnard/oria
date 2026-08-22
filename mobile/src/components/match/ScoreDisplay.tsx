import { View, Text, Image, StyleSheet } from 'react-native';
import { PulseDot } from '../ui/PulseDot';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import type { Fixture } from '@/src/api/catalog';
import { LIVE } from '@/src/lib/contextRules';

interface Props {
  fixture: Fixture;
}

export function ScoreDisplay({ fixture }: Props) {
  const isLive = LIVE.includes((fixture.status ?? '').toUpperCase());
  const hasScore = fixture.score_home != null && fixture.score_away != null;

  return (
    <View style={styles.container}>
      {/* League */}
      <View style={styles.leagueRow}>
        {fixture.league_logo ? (
          <View style={styles.leagueLogoWrap}>
            <Image source={{ uri: fixture.league_logo }} style={styles.leagueLogo} resizeMode="contain" />
          </View>
        ) : null}
        <Text style={styles.leagueName}>{fixture.league_name}</Text>
        {fixture.round ? <Text style={styles.round}>{fixture.round}</Text> : null}
      </View>

      {/* Teams + Score */}
      <View style={styles.scoreRow}>
        <View style={styles.teamCol}>
          {fixture.home_logo ? (
            <View style={styles.teamLogoWrap}>
              <Image source={{ uri: fixture.home_logo }} style={styles.teamLogo} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.teamName} numberOfLines={2}>{fixture.home_team}</Text>
        </View>

        <View style={styles.scoreCol}>
          {hasScore ? (
            <Text style={[styles.score, isLive && styles.scoreLive]}>
              {fixture.score_home} - {fixture.score_away}
            </Text>
          ) : (
            <Text style={styles.vs}>VS</Text>
          )}
          {isLive ? (
            <View style={styles.statusBadge}>
              <PulseDot size={5} />
              <Text style={styles.statusText}>
                {fixture.elapsed ? `${fixture.elapsed}'` : 'LIVE'}
              </Text>
            </View>
          ) : (
            <Text style={styles.statusLabel}>{fixture.status_long ?? fixture.status}</Text>
          )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leagueLogoWrap: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueLogo: {
    width: 13,
    height: 13,
  },
  leagueName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textMuted,
  },
  round: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSubtle,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  teamCol: {
    alignItems: 'center',
    width: 90,
    gap: 8,
  },
  teamLogoWrap: {
    width: 54,
    height: 54,
    borderRadius: 12,
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
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  scoreCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  score: {
    fontFamily: fonts.monoBold,
    fontSize: 40,
    color: colors.text,
  },
  scoreLive: {
    color: colors.text,
  },
  vs: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.liveSurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.liveLight,
  },
  statusLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSubtle,
  },
});
