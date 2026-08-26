import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, Image, Pressable,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { listLiveFixtures, listFixtures, type Fixture } from '@/src/api/catalog';
import { listFollows, type Follow } from '@/src/api/follows';
import { useAuth } from '@/src/hooks/useAuth';
import { FeaturedMatchCard } from '@/src/components/home/FeaturedMatchCard';
import { AskOriaButton } from '@/src/components/home/AskOriaButton';
import { MatchCard } from '@/src/components/scores/MatchCard';
import { DateBar } from '@/src/components/home/DateBar';
import { LeagueFilterSheet, type SelectedLeague } from '@/src/components/home/LeagueFilterSheet';
import { PulseDot } from '@/src/components/ui/PulseDot';

// Ligues majeures \u2014 IDs API-Football
const MAJOR_LEAGUE_IDS = new Set([
  2, 3, 848,             // UEFA
  1, 15,                  // FIFA
  4, 9, 6,                // Continentales
  61, 39, 140, 135, 78,   // Top 5
  94, 207, 203,            // Tier 2
]);

const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

interface LeagueGroup {
  league: string;
  leagueId?: number;
  country?: string;
  logo?: string;
  isMajor: boolean;
  data: Fixture[];
}

type ListItem =
  | { kind: 'section'; title: string; key: string }
  | { kind: 'league'; group: LeagueGroup; key: string };

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildLeagueGroups(items: Fixture[]): LeagueGroup[] {
  const groups: LeagueGroup[] = [];
  items.forEach(f => {
    const existing = groups.find(g => g.leagueId === f.league_id);
    if (existing) {
      existing.data.push(f);
    } else {
      groups.push({
        league: f.league_name ?? '',
        leagueId: f.league_id,
        country: f.league_country,
        logo: f.league_logo,
        isMajor: !!(f.league_id && MAJOR_LEAGUE_IDS.has(f.league_id)),
        data: [f],
      });
    }
  });
  groups.sort((a, b) => {
    if (a.isMajor && !b.isMajor) return -1;
    if (!a.isMajor && b.isMajor) return 1;
    return a.league.localeCompare(b.league);
  });
  return groups;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();

  // --- State ---
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);
  const [dateFixtures, setDateFixtures] = useState<Fixture[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => fmtDate(new Date()));
  const [selectedLeague, setSelectedLeague] = useState<SelectedLeague | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const todayStr = useMemo(() => fmtDate(new Date()), []);
  const isToday = selectedDate === todayStr;

  // --- Followed league/team IDs ---
  const followedLeagueIds = useMemo(
    () => new Set(follows.filter(f => f.entity_type === 'league').map(f => f.entity_id)),
    [follows],
  );
  const followedTeamIds = useMemo(
    () => new Set(follows.filter(f => f.entity_type === 'team').map(f => f.entity_id)),
    [follows],
  );

  // --- Merged fixtures (date fixtures + live overrides for today) ---
  const fixtures = useMemo(() => {
    const map = new Map<number, Fixture>();
    dateFixtures.forEach(f => map.set(f.id, f));
    if (isToday) {
      // Live overrides date fixtures for same ID (fresher status/scores)
      const relevantLive = selectedLeague
        ? liveFixtures.filter(f => f.league_id === selectedLeague.id)
        : liveFixtures;
      relevantLive.forEach(f => map.set(f.id, f));
    }
    return Array.from(map.values());
  }, [dateFixtures, liveFixtures, isToday, selectedLeague]);

  // --- Data loading ---
  const fetchLive = useCallback(async () => {
    try {
      const data = await listLiveFixtures();
      setLiveFixtures(data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  const fetchDateData = useCallback(async (
    date: string,
    league: SelectedLeague | null,
    followedIds: Set<number>,
  ) => {
    setDateLoading(true);
    try {
      let data: Fixture[];
      if (league) {
        // Single league → one targeted API call
        data = await listFixtures({ leagueId: league.id, dateFrom: date, dateTo: date });
      } else {
        // No league filter → one call for ALL fixtures on that date,
        // then filter client-side to major + followed leagues.
        // This avoids 13+ parallel API calls that exhaust rate limits.
        const all = await listFixtures({ date });
        const relevantIds = new Set([...MAJOR_LEAGUE_IDS, ...followedIds]);
        data = all.filter(f => f.league_id != null && relevantIds.has(f.league_id));
      }
      setDateFixtures(data);
      setFetchError(false);
    } catch {
      setDateFixtures([]);
      setFetchError(true);
    }
    setDateLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [, followsRes] = await Promise.allSettled([
        fetchLive(),
        token ? listFollows().catch(() => [] as Follow[]) : Promise.resolve([] as Follow[]),
      ]);
      const fols = followsRes.status === 'fulfilled' ? followsRes.value : [];
      if (cancelled) return;
      setFollows(fols);
      const folIds = new Set(
        fols.filter(f => f.entity_type === 'league').map(f => f.entity_id),
      );
      fetchDateData(fmtDate(new Date()), null, folIds);
    }
    init();
    timerRef.current = setInterval(fetchLive, 60_000);
    return () => { cancelled = true; clearInterval(timerRef.current); };
  }, [fetchLive, fetchDateData, token]);

  // Handlers for date/league changes (no effect — avoids double-fetch)
  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    fetchDateData(date, selectedLeague, followedLeagueIds);
  }, [fetchDateData, selectedLeague, followedLeagueIds]);

  const handleLeagueSelect = useCallback((league: SelectedLeague | null) => {
    setSelectedLeague(league);
    fetchDateData(selectedDate, league, followedLeagueIds);
  }, [fetchDateData, selectedDate, followedLeagueIds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const [, followsRes] = await Promise.allSettled([
      fetchLive(),
      token ? listFollows().catch(() => [] as Follow[]) : Promise.resolve([] as Follow[]),
    ]);
    const fols = followsRes.status === 'fulfilled' ? followsRes.value : [];
    setFollows(fols);
    const folIds = new Set(
      fols.filter(f => f.entity_type === 'league').map(f => f.entity_id),
    );
    await fetchDateData(selectedDate, selectedLeague, folIds);
    setRefreshing(false);
  }, [fetchLive, fetchDateData, selectedDate, selectedLeague, token]);

  // --- Live count (from all live fixtures, not filtered) ---
  const totalLiveCount = useMemo(
    () => liveFixtures.filter(f =>
      LIVE_STATUSES.includes((f.status ?? '').toUpperCase()),
    ).length,
    [liveFixtures],
  );

  // --- Featured match (only for today) ---
  const featured = useMemo(() => {
    if (!isToday) return null;
    const live = fixtures.filter(f =>
      LIVE_STATUSES.includes((f.status ?? '').toUpperCase()),
    );
    // Priority: major league live > followed live > any live > nearest upcoming
    const majorLive = live.find(f => f.league_id && MAJOR_LEAGUE_IDS.has(f.league_id));
    if (majorLive) return majorLive;
    const followedLive = live.find(f =>
      (f.league_id && followedLeagueIds.has(f.league_id)) ||
      (f.home_id && followedTeamIds.has(f.home_id)) ||
      (f.away_id && followedTeamIds.has(f.away_id)),
    );
    if (followedLive) return followedLive;
    if (live[0]) return live[0];
    const upcoming = fixtures
      .filter(f => {
        const s = (f.status ?? '').toUpperCase();
        return !LIVE_STATUSES.includes(s) && !FINISHED_STATUSES.includes(s);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] ?? null;
  }, [fixtures, isToday, followedLeagueIds, followedTeamIds]);

  // --- Classify & group fixtures (excluding featured) ---
  const others = useMemo(
    () => fixtures.filter(f => f.id !== featured?.id),
    [fixtures, featured],
  );

  const liveOthers = useMemo(() =>
    others.filter(f => LIVE_STATUSES.includes((f.status ?? '').toUpperCase())),
    [others],
  );
  const upcomingOthers = useMemo(() =>
    [...others]
      .filter(f => {
        const s = (f.status ?? '').toUpperCase();
        return !LIVE_STATUSES.includes(s) && !FINISHED_STATUSES.includes(s);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [others],
  );
  const finishedOthers = useMemo(() =>
    [...others]
      .filter(f => FINISHED_STATUSES.includes((f.status ?? '').toUpperCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [others],
  );

  const listItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    const liveGroups = buildLeagueGroups(liveOthers);
    const upGroups = buildLeagueGroups(upcomingOthers);
    const finGroups = buildLeagueGroups(finishedOthers);

    if (liveGroups.length > 0) {
      items.push({ kind: 'section', title: 'EN DIRECT', key: 's-live' });
      liveGroups.forEach(g => items.push({ kind: 'league', group: g, key: `live-${g.leagueId ?? g.league}` }));
    }
    if (upGroups.length > 0) {
      items.push({ kind: 'section', title: '\u00C0 VENIR', key: 's-upcoming' });
      upGroups.forEach(g => items.push({ kind: 'league', group: g, key: `up-${g.leagueId ?? g.league}` }));
    }
    if (finGroups.length > 0) {
      items.push({ kind: 'section', title: 'TERMIN\u00C9S', key: 's-finished' });
      finGroups.forEach(g => items.push({ kind: 'league', group: g, key: `fin-${g.leagueId ?? g.league}` }));
    }
    return items;
  }, [liveOthers, upcomingOthers, finishedOthers]);

  // --- Navigation helpers ---
  const initials = (user?.display_name ?? user?.email ?? 'U')
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const openMatch = (f: Fixture) => router.push(`/(main)/match/${f.id}`);
  const openChat = () => router.push({ pathname: '/(main)/chat' });

  const openMatchInChat = useCallback((f: Fixture) => {
    router.push({
      pathname: '/(main)/chat',
      params: {
        fixtureId: String(f.id),
        fixtureHome: f.home_team,
        fixtureAway: f.away_team,
        ...(f.home_id ? { fixtureHomeId: String(f.home_id) } : {}),
        ...(f.away_id ? { fixtureAwayId: String(f.away_id) } : {}),
        ...(f.home_logo ? { fixtureHomeLogo: f.home_logo } : {}),
        ...(f.away_logo ? { fixtureAwayLogo: f.away_logo } : {}),
        ...(f.league_id ? { leagueId: String(f.league_id) } : {}),
        ...(f.league_name ? { leagueName: f.league_name } : {}),
        ...(f.league_logo ? { leagueLogo: f.league_logo } : {}),
        ...(f.league_country ? { leagueCountry: f.league_country } : {}),
        ...(f.status ? { fixtureStatus: f.status } : {}),
        ...(f.round ? { fixtureRound: f.round } : {}),
      },
    });
  }, [router]);

  const filterLabel = selectedLeague
    ? `${selectedLeague.country} \u00B7 ${selectedLeague.name}`
    : 'Toutes les ligues';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>Oria</Text>
          {totalLiveCount > 0 && (
            <View style={styles.liveBadge}>
              <PulseDot size={5} />
              <Text style={styles.liveText}>
                {totalLiveCount} {totalLiveCount > 1 ? 'MATCHS' : 'MATCH'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push('/(main)/search')} style={styles.iconBtn}>
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

      {/* League filter button */}
      <View style={styles.filterRow}>
        <Pressable style={styles.filterBtn} onPress={() => setFilterVisible(true)}>
          {selectedLeague?.logo ? (
            <View style={styles.filterLogoWrap}>
              <Image source={{ uri: selectedLeague.logo }} style={styles.filterLogo} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.filterLabel} numberOfLines={1}>{filterLabel}</Text>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path d="M6 9l6 6 6-6" stroke={colors.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      {/* Date navigation bar */}
      <DateBar selectedDate={selectedDate} onDateChange={handleDateChange} />

      {/* Content */}
      <FlatList
        data={listItems}
        keyExtractor={item => item.key}
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
            {/* Loading indicator */}
            {dateLoading && (
              <View style={styles.dateLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}

            {/* Featured match (today only) */}
            {featured && !dateLoading && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {liveOthers.length > 0 || LIVE_STATUSES.includes((featured.status ?? '').toUpperCase())
                    ? 'MATCH EN DIRECT'
                    : 'MATCH DU JOUR'}
                </Text>
                <FeaturedMatchCard
                  fixture={featured}
                  onPress={() => openMatch(featured)}
                  onContextPress={() => openMatchInChat(featured)}
                />
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === 'section') {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }
          const group = item.group;
          return (
            <View style={styles.leagueGroup}>
              {!selectedLeague && (
                <View style={styles.leagueHeader}>
                  {group.logo ? (
                    <View style={styles.leagueLogoWrap}>
                      <Image source={{ uri: group.logo }} style={styles.leagueLogo} resizeMode="contain" />
                    </View>
                  ) : null}
                  <Text style={styles.leagueName}>
                    {group.country ? `${group.country} \u00B7 ${group.league}` : group.league}
                  </Text>
                  {group.isMajor && <View style={styles.majorDot} />}
                </View>
              )}
              {group.data.map(f => (
                <MatchCard
                  key={f.id}
                  fixture={f}
                  onPress={openMatch}
                  onContextPress={openMatchInChat}
                />
              ))}
            </View>
          );
        }}
        ListEmptyComponent={
          dateLoading ? null : fetchError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Impossible de charger les matchs</Text>
              <Text style={styles.emptyBody}>
                {"V\u00E9rifie ta connexion et tire vers le bas pour r\u00E9essayer."}
              </Text>
            </View>
          ) : !featured ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucun match ce jour</Text>
              <Text style={styles.emptyBody}>
                {"Navigue vers un autre jour ou s\u00E9lectionne une autre ligue."}
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

      {/* League filter sheet */}
      <LeagueFilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        onSelect={handleLeagueSelect}
      />
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
  filterRow: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  filterLogoWrap: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterLogo: {
    width: 14,
    height: 14,
  },
  filterLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    maxWidth: 220,
  },
  list: {
    paddingBottom: 100,
  },
  dateLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.9,
    paddingHorizontal: 18,
    marginBottom: 8,
    marginTop: 14,
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
    flex: 1,
  },
  majorDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.bg,
  },
});
