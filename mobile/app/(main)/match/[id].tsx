import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { ScoreDisplay } from '@/src/components/match/ScoreDisplay';
import { StatBar } from '@/src/components/match/StatBar';
import { useFixture } from '@/src/hooks/useFixture';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fixture, loading } = useFixture(Number(id));

  if (loading || !fixture) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Match" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const openChat = () =>
    router.push({
      pathname: '/(main)/chat',
      params: { prefill: `Analyse du match ${fixture.home_team} - ${fixture.away_team}` },
    });

  const openTeam = (teamId?: number) => {
    if (teamId) router.push(`/(main)/team/${teamId}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <ScoreDisplay fixture={fixture} />

        {/* Team tap targets */}
        <View style={styles.teamTapRow}>
          <Pressable style={styles.teamTap} onPress={() => openTeam(fixture.home_id)}>
            <Text style={styles.teamTapText}>Voir {fixture.home_team}</Text>
          </Pressable>
          <Pressable style={styles.teamTap} onPress={() => openTeam(fixture.away_id)}>
            <Text style={styles.teamTapText}>Voir {fixture.away_team}</Text>
          </Pressable>
        </View>

        {/* Info bar */}
        <View style={styles.infoCard}>
          {fixture.venue?.name ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Stade</Text>
              <Text style={styles.infoValue}>{fixture.venue.name}</Text>
            </View>
          ) : null}
          {fixture.referee ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Arbitre</Text>
              <Text style={styles.infoValue}>{fixture.referee}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {new Date(fixture.date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Stats section */}
        <Text style={styles.sectionTitle}>STATISTIQUES</Text>
        <View style={styles.statsCard}>
          <StatBar label="Possession %" home={55} away={45} />
          <StatBar label="Tirs" home={12} away={8} />
          <StatBar label="Tirs cadrés" home={5} away={3} />
          <StatBar label="Corners" home={6} away={4} />
          <StatBar label="Fautes" home={10} away={14} />
        </View>

        {/* CTA */}
        <Pressable style={styles.ctaBtn} onPress={openChat}>
          <Text style={styles.ctaText}>Questionner ce match</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
  },
  teamTapRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  teamTap: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamTapText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSubtle,
  },
  infoValue: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.text,
    textAlign: 'right',
    maxWidth: '60%',
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.bg,
  },
});
