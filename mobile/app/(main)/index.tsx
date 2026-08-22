import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { listLiveFixtures, type Fixture } from '@/src/api/catalog';
import { useAuth } from '@/src/hooks/useAuth';
import { FeaturedMatchCard } from '@/src/components/home/FeaturedMatchCard';
import { QuickAskChips } from '@/src/components/home/QuickAskChips';
import { AskOriaButton } from '@/src/components/home/AskOriaButton';
import { MatchCard } from '@/src/components/scores/MatchCard';
import { PulseDot } from '@/src/components/ui/PulseDot';

const QUICK_ASKS = [
  'Compos probables',
  'Derniers résultats',
  'Classement',
  'Buteurs',
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    try {
      const data = await listLiveFixtures();
      setFixtures(data);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, 60_000);
    return () => clearInterval(timerRef.current);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const liveFixtures = fixtures.filter(f =>
    ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'].includes((f.status ?? '').toUpperCase()),
  );
  const featured = liveFixtures[0] ?? fixtures[0];
  const others = fixtures.filter(f => f.id !== featured?.id);
  const liveCount = liveFixtures.length;

  // Group fixtures by league
  const grouped: { league: string; logo?: string; data: Fixture[] }[] = [];
  others.forEach(f => {
    const existing = grouped.find(g => g.league === f.league_name);
    if (existing) {
      existing.data.push(f);
    } else {
      grouped.push({ league: f.league_name ?? '', logo: f.league_logo, data: [f] });
    }
  });

  const initials = (user?.display_name ?? user?.email ?? 'U')
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const openMatch = (f: Fixture) => router.push(`/(main)/match/${f.id}`);
  const openChat = (prefill?: string) =>
    router.push({ pathname: '/(main)/chat', params: prefill ? { prefill } : {} });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>Oria</Text>
          {liveCount > 0 && (
            <View style={styles.liveBadge}>
              <PulseDot size={5} />
              <Text style={styles.liveText}>{liveCount} EN DIRECT</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push('/(main)/palette')} style={styles.iconBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx={11} cy={11} r={7} stroke={colors.text} strokeWidth={2} />
              <Path d="m20 20-4.3-4.3" stroke={colors.text} strokeWidth={2} />
            </Svg>
          </Pressable>
          <Pressable onPress={() => router.push('/(main)/notifications')} style={styles.iconBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={colors.text} strokeWidth={2} />
              <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={colors.text} strokeWidth={2} />
            </Svg>
          </Pressable>
          <Pressable onPress={() => router.push('/(main)/profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.league}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Featured match */}
            {featured && (
              <View style={styles.section}>
                <FeaturedMatchCard fixture={featured} onPress={() => openMatch(featured)} />
              </View>
            )}

            {/* Quick ask chips */}
            <View style={styles.chipsSection}>
              <QuickAskChips chips={QUICK_ASKS} onPress={(text) => openChat(text)} />
            </View>

            {/* Section title */}
            {grouped.length > 0 && (
              <Text style={styles.sectionTitle}>TOUS LES SCORES</Text>
            )}
          </>
        }
        renderItem={({ item: group }) => (
          <View style={styles.leagueGroup}>
            <View style={styles.leagueHeader}>
              {group.logo ? (
                <View style={styles.leagueLogoWrap}>
                  <Image source={{ uri: group.logo }} style={styles.leagueLogo} resizeMode="contain" />
                </View>
              ) : null}
              <Text style={styles.leagueName}>{group.league}</Text>
            </View>
            {group.data.map(f => (
              <MatchCard key={f.id} fixture={f} onPress={openMatch} />
            ))}
          </View>
        )}
        ListEmptyComponent={
          !featured ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Pas de match en ce moment.</Text>
              <Text style={styles.emptyBody}>
                Reviens pendant une journée de championnat, ou pose directement ta question à Oria.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />

      {/* Floating CTA */}
      <View style={[styles.fab, { paddingBottom: insets.bottom + 8 }]}>
        <AskOriaButton onPress={() => openChat()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.text,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.liveSurface,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveText: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    color: colors.liveLight,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sansExtraBold,
    fontSize: 12,
    color: colors.primaryText,
  },
  list: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  chipsSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.9,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  leagueGroup: {
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
    width: 14,
    height: 14,
  },
  leagueName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  empty: {
    padding: 30,
    gap: 9,
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 23,
    color: colors.text,
    lineHeight: 28,
  },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textSubtle,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    // Gradient effect via background
    backgroundColor: colors.bg,
  },
});
