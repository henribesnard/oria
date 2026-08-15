import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { MatchCard } from '@/src/components/scores/MatchCard';
import { MatchDetailModal } from '@/src/components/scores/MatchDetailModal';
import { listLiveFixtures, type Fixture } from '@/src/api/catalog';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const TABS = [
  { key: 'live', label: 'En direct' },
  { key: 'ft', label: 'Terminés' },
  { key: 'pre', label: 'À venir' },
];

function classifyStatus(status?: string): 'live' | 'ft' | 'pre' {
  const s = status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'ft';
  return 'pre';
}

export default function ScoresScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState('live');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listLiveFixtures();
      setFixtures(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAddToChat = useCallback((fixture: Fixture) => {
    // Navigate to chat tab — the context will be passed via params
    router.push({ pathname: '/(tabs)', params: { fixture_id: String(fixture.id), fixture_label: `${fixture.home_team} — ${fixture.away_team}`, league_id: fixture.league_id ? String(fixture.league_id) : undefined, league_label: fixture.league_name } });
  }, [router]);

  const filtered = fixtures.filter(f => classifyStatus(f.status) === tab);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scores en direct</Text>
      </View>

      <SegmentedControl tabs={TABS} selected={tab} onSelect={setTab} />

      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        renderItem={({ item }) => <MatchCard fixture={item} onPress={setSelectedFixture} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>Aucun match</Text>
          ) : null
        }
      />

      <MatchDetailModal
        fixture={selectedFixture}
        visible={selectedFixture !== null}
        onClose={() => setSelectedFixture(null)}
        onAddToChat={handleAddToChat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? fonts.sansBold : fonts.sansExtraBold,
    fontSize: Platform.OS === 'ios' ? 16 : 20,
    color: colors.text,
    textAlign: Platform.OS === 'ios' ? 'center' : 'left',
    flex: 1,
  },
  list: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    paddingBottom: 100,
    gap: 8,
  },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: 30,
  },
});
