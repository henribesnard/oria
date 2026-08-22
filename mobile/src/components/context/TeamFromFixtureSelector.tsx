import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import type { Fixture } from '@/src/api/catalog';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  fixture: Fixture;
  onSelectTeam: (teamId: number, teamName: string, teamLogo?: string) => void;
  onSeeAllTeams: () => void;
}

export function TeamFromFixtureSelector({ fixture, onSelectTeam, onSeeAllTeams }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CHOISIR UNE ÉQUIPE</Text>

      <Pressable
        style={styles.teamCard}
        onPress={() => onSelectTeam(fixture.home_id!, fixture.home_team, fixture.home_logo)}
      >
        {fixture.home_logo ? (
          <View style={styles.logoWrap}>
            <Image source={{ uri: fixture.home_logo }} style={styles.logo} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>{fixture.home_team[0]}</Text>
          </View>
        )}
        <Text style={styles.teamName}>{fixture.home_team}</Text>
      </Pressable>

      <Pressable
        style={styles.teamCard}
        onPress={() => onSelectTeam(fixture.away_id!, fixture.away_team, fixture.away_logo)}
      >
        {fixture.away_logo ? (
          <View style={styles.logoWrap}>
            <Image source={{ uri: fixture.away_logo }} style={styles.logo} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>{fixture.away_team[0]}</Text>
          </View>
        )}
        <Text style={styles.teamName}>{fixture.away_team}</Text>
      </Pressable>

      <Pressable style={styles.allTeamsBtn} onPress={onSeeAllTeams}>
        <Text style={styles.allTeamsText}>Voir tous les clubs {'\u2192'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 28,
    height: 28,
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.primary,
  },
  teamName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  allTeamsBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  allTeamsText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
});
