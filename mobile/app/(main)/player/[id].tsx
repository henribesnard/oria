import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { StatsGrid } from '@/src/components/player/StatsGrid';
import { getSquad, searchCatalog, type Player } from '@/src/api/catalog';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const SUGGESTIONS = [
  'Comment se comporte-t-il cette saison ?',
  'Quels sont ses points forts ?',
  'Compare-le à un joueur similaire',
];

export default function PlayerScreen() {
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let found: Player | undefined;
        if (teamId) {
          const squad = await getSquad(Number(teamId));
          found = squad.find(p => p.id === Number(id));
        }
        if (!found) {
          const results = await searchCatalog(id);
          const match = results.find(r => r.type === 'player' && r.id === Number(id));
          if (match) {
            found = { id: match.id, name: match.name, photo: match.photo };
          }
        }
        if (!cancelled && found) setPlayer(found);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id, teamId]);

  const openChat = (prefill?: string) =>
    router.push({
      pathname: '/(main)/chat',
      params: { prefill: prefill ?? `Question sur ${player?.name ?? 'ce joueur'}` },
    });

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Joueur" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const name = player?.name ?? 'Joueur';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        {/* Player header */}
        <View style={styles.playerHeader}>
          {player?.photo ? (
            <Image source={{ uri: player.photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitial}>{name[0]}</Text>
            </View>
          )}
          <Text style={styles.playerName}>{name}</Text>
          <View style={styles.metaRow}>
            {player?.position && <Text style={styles.metaText}>{player.position}</Text>}
            {player?.age && <Text style={styles.metaText}>{player.age} ans</Text>}
            {player?.number != null && <Text style={styles.metaText}>#{player.number}</Text>}
          </View>
        </View>

        {/* Stats grid */}
        <Text style={styles.sectionTitle}>STATISTIQUES</Text>
        <StatsGrid stats={(() => {
          const s = (player as Record<string, unknown> | null)?.statistics;
          const first = Array.isArray(s) && s.length > 0 ? (s[0] as Record<string, unknown>) : null;
          const games = first?.games as Record<string, unknown> | undefined;
          const goals = first?.goals as Record<string, unknown> | undefined;
          return [
            { label: 'Matchs', value: games?.appearences != null ? String(games.appearences) : '—' },
            { label: 'Buts', value: goals?.total != null ? String(goals.total) : '—' },
            { label: 'Passes D.', value: goals?.assists != null ? String(goals.assists) : '—' },
            { label: 'Note moy.', value: first?.rating != null ? String(first.rating) : '—' },
          ];
        })()} />

        {/* Suggestions */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>À DEMANDER</Text>
        <View style={styles.suggestionsCol}>
          {SUGGESTIONS.map((s, i) => (
            <Pressable key={i} style={styles.suggestionBtn} onPress={() => openChat(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </View>

        {/* CTA */}
        <Pressable style={styles.ctaBtn} onPress={() => openChat()}>
          <Text style={styles.ctaText}>Question sur {name}</Text>
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
  playerHeader: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  photo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  photoPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: {
    fontFamily: fonts.sansBold,
    fontSize: 28,
    color: colors.primary,
  },
  playerName: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSubtle,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  suggestionsCol: {
    gap: 6,
  },
  suggestionBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.bg,
  },
});
