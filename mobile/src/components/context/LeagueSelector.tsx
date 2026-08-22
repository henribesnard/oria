import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { listLeagues, listLiveFixtures, type League, type Fixture } from '@/src/api/catalog';
import { listFollows, type Follow } from '@/src/api/follows';
import { SearchInput } from '../ui/SearchInput';
import { PulseDot } from '../ui/PulseDot';
import { EmptyState } from './EmptyState';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const POPULAR_COUNTRIES = [
  { code: 'FR', flag: '\uD83C\uDDEB\uD83C\uDDF7', label: 'France' },
  { code: 'EN', flag: '\uD83C\uDDEC\uD83C\uDDE7', label: 'Angleterre' },
  { code: 'ES', flag: '\uD83C\uDDEA\uD83C\uDDF8', label: 'Espagne' },
  { code: 'IT', flag: '\uD83C\uDDEE\uD83C\uDDF9', label: 'Italie' },
  { code: 'DE', flag: '\uD83C\uDDE9\uD83C\uDDEA', label: 'Allemagne' },
];

interface Props {
  onSelectLeague: (league: League) => void;
  onShowAllCountries: () => void;
}

export function LeagueSelector({ onSelectLeague, onShowAllCountries }: Props) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [liveLeagueIds, setLiveLeagueIds] = useState<Set<number>>(new Set());
  const [filterCountry, setFilterCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [leaguesData, followsData, liveData] = await Promise.all([
          listLeagues().catch(() => [] as League[]),
          listFollows('league').catch(() => [] as Follow[]),
          listLiveFixtures().catch(() => [] as Fixture[]),
        ]);

        if (cancelled) return;

        const liveIds = new Set<number>();
        for (const f of liveData) {
          const status = (f.status ?? '').toUpperCase();
          if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'].includes(status)) {
            if (f.league_id) liveIds.add(f.league_id);
          }
        }

        setAllLeagues(leaguesData);
        setFollows(followsData);
        setLiveLeagueIds(liveIds);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const normalize = useCallback((s: string) => {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }, []);

  const filtered = allLeagues.filter(l => {
    if (filterCountry && l.country !== filterCountry) return false;
    if (search) {
      const q = normalize(search);
      return normalize(l.name).includes(q) || normalize(l.country ?? '').includes(q);
    }
    return true;
  });

  const followedIds = new Set(follows.map(f => f.entity_id));
  const followedLeagues = filtered.filter(l => followedIds.has(l.id));
  const majorLeagues = filtered.filter(l => !followedIds.has(l.id));

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une ligue…"
      />

      {/* Country filter chips */}
      {!search && (
        <View style={styles.countryRow}>
          {POPULAR_COUNTRIES.map(c => (
            <Pressable
              key={c.code}
              style={[styles.countryChip, filterCountry === c.label && styles.countryChipActive]}
              onPress={() => setFilterCountry(filterCountry === c.label ? null : c.label)}
            >
              <Text style={styles.countryFlag}>{c.flag}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.allCountriesBtn} onPress={onShowAllCountries}>
            <Text style={styles.allCountriesText}>Tous</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={[
          ...(followedLeagues.length > 0 ? [{ type: 'header' as const, title: 'TES LIGUES' }] : []),
          ...followedLeagues.map(l => ({ type: 'league' as const, league: l })),
          ...(majorLeagues.length > 0 ? [{ type: 'header' as const, title: filterCountry ?? 'MAJEURES' }] : []),
          ...majorLeagues.map(l => ({ type: 'league' as const, league: l })),
        ]}
        keyExtractor={(item, i) => item.type === 'header' ? `h-${item.title}` : `l-${(item as any).league.id}`}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <Text style={styles.sectionHeader}>{item.title}</Text>
            );
          }
          const league = (item as { type: 'league'; league: League }).league;
          const isLive = liveLeagueIds.has(league.id);
          return (
            <Pressable style={styles.leagueRow} onPress={() => onSelectLeague(league)}>
              {league.logo ? (
                <View style={styles.logoWrap}>
                  <Image source={{ uri: league.logo }} style={styles.logo} resizeMode="contain" />
                </View>
              ) : (
                <View style={styles.monogram}>
                  <Text style={styles.monogramText}>{(league.name)[0]}</Text>
                </View>
              )}
              <View style={styles.leagueInfo}>
                <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
                <Text style={styles.leagueCountry} numberOfLines={1}>{league.country}</Text>
              </View>
              {isLive && (
                <View style={styles.liveBadge}>
                  <PulseDot size={5} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Aucune ligue trouvée" />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  countryRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  countryChip: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  countryFlag: {
    fontSize: 16,
  },
  allCountriesBtn: {
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allCountriesText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  sectionHeader: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    paddingVertical: 8,
    marginTop: 4,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  logoWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 22,
    height: 22,
  },
  monogram: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primary,
  },
  leagueInfo: {
    flex: 1,
    gap: 1,
  },
  leagueName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  leagueCountry: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textSubtle,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.liveSurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveText: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    color: colors.liveLight,
    letterSpacing: 0.4,
  },
});
