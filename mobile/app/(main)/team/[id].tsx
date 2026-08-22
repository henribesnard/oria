import { View, Text, ScrollView, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { FormBadges } from '@/src/components/team/FormBadges';
import { MatchCard } from '@/src/components/scores/MatchCard';
import { useTeam } from '@/src/hooks/useTeam';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const POSITION_LABELS: Record<string, string> = {
  Goalkeeper: 'GARDIENS',
  Defender: 'DÉFENSEURS',
  Midfielder: 'MILIEUX',
  Attacker: 'ATTAQUANTS',
};

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { team, recentFixtures, nextFixture, squad, loading } = useTeam(Number(id));

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Équipe" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const teamName = team?.name ?? 'Équipe';
  const teamId = Number(id);

  const openChat = () =>
    router.push({
      pathname: '/(main)/chat',
      params: { prefill: `Question sur ${teamName}` },
    });

  const openPlayer = (playerId: number) =>
    router.push(`/(main)/player/${playerId}`);

  const positions = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];
  const groupedSquad = positions
    .map(pos => ({
      position: pos,
      label: POSITION_LABELS[pos] ?? pos.toUpperCase(),
      players: squad.filter(p => p.position === pos),
    }))
    .filter(g => g.players.length > 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        {/* Team header */}
        <View style={styles.teamHeader}>
          {team?.logo ? (
            <View style={styles.crestWrap}>
              <Image source={{ uri: team.logo }} style={styles.crest} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.teamName}>{teamName}</Text>
          <FormBadges fixtures={recentFixtures} teamId={teamId} />
        </View>

        {/* Next match */}
        {nextFixture && (
          <>
            <Text style={styles.sectionTitle}>PROCHAIN MATCH</Text>
            <MatchCard fixture={nextFixture} onPress={(f) => router.push(`/(main)/match/${f.id}`)} />
            <View style={{ height: 16 }} />
          </>
        )}

        {/* Squad */}
        {groupedSquad.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>EFFECTIF</Text>
            {groupedSquad.map(group => (
              <View key={group.position}>
                <Text style={styles.positionLabel}>{group.label}</Text>
                {group.players.map(p => (
                  <Pressable key={p.id} style={styles.playerRow} onPress={() => openPlayer(p.id)}>
                    {p.number != null && (
                      <Text style={styles.playerNumber}>{p.number}</Text>
                    )}
                    {p.photo ? (
                      <Image source={{ uri: p.photo }} style={styles.playerPhoto} />
                    ) : (
                      <View style={styles.playerPhotoPlaceholder}>
                        <Text style={styles.playerInitial}>{p.name[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        )}

        {/* CTA */}
        <Pressable style={styles.ctaBtn} onPress={openChat}>
          <Text style={styles.ctaText}>Question sur {teamName}</Text>
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
  teamHeader: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  crestWrap: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crest: {
    width: 50,
    height: 50,
  },
  teamName: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  positionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textGhost,
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  playerNumber: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSubtle,
    width: 22,
    textAlign: 'center',
  },
  playerPhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  playerPhotoPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInitial: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.primary,
  },
  playerName: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.text,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.bg,
  },
});
