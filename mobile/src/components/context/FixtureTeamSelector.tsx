import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { listFixtures, listTeams, type Fixture, type Team, type League } from '@/src/api/catalog';
import { currentSeason, snapWindow, LIVE, FINISHED, UPCOMING } from '@/src/lib/contextRules';
import { SearchInput } from '../ui/SearchInput';
import { PulseDot } from '../ui/PulseDot';
import { EmptyState } from './EmptyState';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

type Tab = 'fixture' | 'team';
type StatusFilter = 'all' | 'live' | 'upcoming' | 'finished';

interface Props {
  league: League;
  onSelectFixture: (fixture: Fixture) => void;
  onSelectTeam: (team: Team) => void;
}

export function FixtureTeamSelector({ league, onSelectFixture, onSelectTeam }: Props) {
  const [tab, setTab] = useState<Tab>('fixture');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const season = currentSeason();
        const { from, to } = snapWindow(undefined, 10, 10);
        const [fixturesData, teamsData] = await Promise.all([
          listFixtures({ leagueId: league.id, season, dateFrom: from, dateTo: to }).catch(() => []),
          listTeams(league.id, season).catch(() => []),
        ]);
        if (!cancelled) {
          setFixtures(fixturesData);
          setTeams(teamsData);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [league.id]);

  const normalize = useCallback((s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), []);

  const filteredFixtures = fixtures.filter(f => {
    const status = (f.status ?? '').toUpperCase();
    if (statusFilter === 'live' && !LIVE.includes(status)) return false;
    if (statusFilter === 'upcoming' && !UPCOMING.includes(status)) return false;
    if (statusFilter === 'finished' && !FINISHED.includes(status)) return false;
    if (search) {
      const q = normalize(search);
      return normalize(f.home_team).includes(q) || normalize(f.away_team).includes(q);
    }
    return true;
  });

  const filteredTeams = teams.filter(t => {
    if (!search) return true;
    return normalize(t.name).includes(normalize(search));
  });

  const isLive = (status?: string) => LIVE.includes((status ?? '').toUpperCase());

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'fixture' && styles.tabActive]}
          onPress={() => { setTab('fixture'); setSearch(''); }}
        >
          <Text style={[styles.tabText, tab === 'fixture' && styles.tabTextActive]}>Affiche</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'team' && styles.tabActive]}
          onPress={() => { setTab('team'); setSearch(''); }}
        >
          <Text style={[styles.tabText, tab === 'team' && styles.tabTextActive]}>Équipe</Text>
        </Pressable>
      </View>

      {/* Status filter chips (fixtures only) */}
      {tab === 'fixture' && (
        <View style={styles.statusRow}>
          {([['all', 'Tous'], ['live', 'En cours'], ['upcoming', 'À venir'], ['finished', 'Terminé']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.statusChip, statusFilter === key && styles.statusChipActive]}
              onPress={() => setStatusFilter(key)}
            >
              <Text style={[styles.statusText, statusFilter === key && styles.statusTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.searchWrap}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'fixture' ? 'Rechercher un match…' : 'Rechercher une équipe…'}
        />
      </View>

      {tab === 'fixture' ? (
        <FlatList
          data={filteredFixtures}
          keyExtractor={f => `${f.id}`}
          renderItem={({ item: f }) => {
            const live = isLive(f.status);
            const hasScore = f.score_home != null && f.score_away != null;
            return (
              <Pressable style={styles.fixtureRow} onPress={() => onSelectFixture(f)}>
                <View style={styles.fixtureTeams}>
                  <View style={styles.fixtureLine}>
                    {f.home_logo ? (
                      <View style={styles.teamLogoWrap}>
                        <Image source={{ uri: f.home_logo }} style={styles.teamLogo} resizeMode="contain" />
                      </View>
                    ) : null}
                    <Text style={styles.teamName} numberOfLines={1}>{f.home_team}</Text>
                    {hasScore && <Text style={[styles.score, live && styles.scoreLive]}>{f.score_home}</Text>}
                  </View>
                  <View style={styles.fixtureLine}>
                    {f.away_logo ? (
                      <View style={styles.teamLogoWrap}>
                        <Image source={{ uri: f.away_logo }} style={styles.teamLogo} resizeMode="contain" />
                      </View>
                    ) : null}
                    <Text style={styles.teamName} numberOfLines={1}>{f.away_team}</Text>
                    {hasScore && <Text style={[styles.score, live && styles.scoreLive]}>{f.score_away}</Text>}
                  </View>
                </View>
                <View style={styles.fixtureRight}>
                  {live ? (
                    <View style={styles.liveBadge}>
                      <PulseDot size={4} />
                      <Text style={styles.liveText}>{f.elapsed ? `${f.elapsed}'` : 'LIVE'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.fixtureDate}>{formatDate(f.date)}</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title="Aucun match trouvé" />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredTeams}
          keyExtractor={t => `${t.id}`}
          renderItem={({ item: t }) => (
            <Pressable style={styles.teamRow} onPress={() => onSelectTeam(t)}>
              {t.logo ? (
                <View style={styles.teamLogoWrap}>
                  <Image source={{ uri: t.logo }} style={styles.teamLogo} resizeMode="contain" />
                </View>
              ) : (
                <View style={styles.monogram}>
                  <Text style={styles.monogramText}>{t.name[0]}</Text>
                </View>
              )}
              <Text style={styles.teamRowName} numberOfLines={1}>{t.name}</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title="Aucune équipe trouvée" />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 2,
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statusChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  statusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  statusTextActive: {
    color: colors.primary,
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  fixtureTeams: {
    flex: 1,
    gap: 4,
  },
  fixtureLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamLogoWrap: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  teamLogo: {
    width: 16,
    height: 16,
  },
  teamName: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
  },
  score: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.textSecondary,
    minWidth: 18,
    textAlign: 'center',
  },
  scoreLive: {
    color: colors.text,
  },
  fixtureRight: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.liveSurface,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveText: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    color: colors.liveLight,
  },
  fixtureDate: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.textSubtle,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  teamRowName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  monogram: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.primary,
  },
});
