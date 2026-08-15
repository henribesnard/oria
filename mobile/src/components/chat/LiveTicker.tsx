import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { listLiveFixtures, type Fixture } from '@/src/api/catalog';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

function classifyStatus(status?: string): 'live' | 'ft' | 'pre' {
  const s = status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'ft';
  return 'pre';
}

function clockLabel(fixture: Fixture): string {
  const s = fixture.status?.toUpperCase() ?? '';
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(s)) {
    return fixture.elapsed ? `${fixture.elapsed}'` : 'Live';
  }
  if (s === 'HT') return 'MT';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'Fin';
  try {
    return new Date(fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function truncate(name: string, max: number): string {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

export function LiveTicker() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [activeLeague, setActiveLeague] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listLiveFixtures();
      setFixtures(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const relevant = fixtures.filter(f => {
    const cls = classifyStatus(f.status);
    return cls === 'live' || cls === 'pre';
  });

  // Extract unique leagues for filter
  const leagues = useMemo(() => {
    const map = new Map<string, { name: string; logo?: string }>();
    for (const f of relevant) {
      const key = f.league_name ?? '';
      if (key && !map.has(key)) {
        map.set(key, { name: key, logo: f.league_logo });
      }
    }
    return Array.from(map.values());
  }, [relevant]);

  const filtered = activeLeague
    ? relevant.filter(f => f.league_name === activeLeague)
    : relevant;

  if (relevant.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* League filter chips */}
      {leagues.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, !activeLeague && styles.filterChipActive]}
            onPress={() => setActiveLeague(null)}
          >
            <Text style={[styles.filterText, !activeLeague && styles.filterTextActive]}>Tous</Text>
          </Pressable>
          {leagues.map(l => (
            <Pressable
              key={l.name}
              style={[styles.filterChip, activeLeague === l.name && styles.filterChipActive]}
              onPress={() => setActiveLeague(activeLeague === l.name ? null : l.name)}
            >
              {l.logo ? <Image source={{ uri: l.logo }} style={styles.filterLogo} resizeMode="contain" /> : null}
              <Text style={[styles.filterText, activeLeague === l.name && styles.filterTextActive]} numberOfLines={1}>
                {truncate(l.name, 12)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Match cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
        {filtered.slice(0, 20).map(f => {
          const cls = classifyStatus(f.status);
          const isLive = cls === 'live';
          const clock = clockLabel(f);
          const hasScore = f.score_home != null && f.score_away != null;

          return (
            <View key={f.id} style={styles.card}>
              {/* League + status header */}
              <View style={styles.cardHeader}>
                {f.league_logo ? <Image source={{ uri: f.league_logo }} style={styles.leagueLogo} resizeMode="contain" /> : null}
                <Text style={styles.leagueName} numberOfLines={1}>{truncate(f.league_name ?? '', 14)}</Text>
                <View style={[styles.statusBadge, isLive ? styles.statusLive : styles.statusPre]}>
                  {isLive && <View style={styles.liveDot} />}
                  <Text style={[styles.statusText, isLive && styles.statusTextLive]}>{clock}</Text>
                </View>
              </View>

              {/* Teams & score */}
              <View style={styles.matchBody}>
                <View style={styles.teamLine}>
                  {f.home_logo ? <Image source={{ uri: f.home_logo }} style={styles.teamLogo} resizeMode="contain" /> : <View style={styles.teamLogoPlaceholder} />}
                  <Text style={styles.teamName} numberOfLines={1}>{truncate(f.home_team, 14)}</Text>
                  <Text style={[styles.score, isLive && styles.scoreLive]}>{hasScore ? f.score_home : '–'}</Text>
                </View>
                <View style={styles.teamLine}>
                  {f.away_logo ? <Image source={{ uri: f.away_logo }} style={styles.teamLogo} resizeMode="contain" /> : <View style={styles.teamLogoPlaceholder} />}
                  <Text style={styles.teamName} numberOfLines={1}>{truncate(f.away_team, 14)}</Text>
                  <Text style={[styles.score, isLive && styles.scoreLive]}>{hasScore ? f.score_away : '–'}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderFocus,
  },
  filterLogo: {
    width: 14,
    height: 14,
  },
  filterText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
  },
  cardRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  card: {
    width: 180,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leagueLogo: {
    width: 14,
    height: 14,
  },
  leagueName: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusLive: {
    backgroundColor: colors.warningLight,
  },
  statusPre: {
    backgroundColor: colors.surfaceMuted,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  statusText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    color: colors.textMuted,
  },
  statusTextLive: {
    color: colors.warningDark,
  },
  matchBody: {
    gap: 4,
  },
  teamLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLogo: {
    width: 18,
    height: 18,
  },
  teamLogoPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  teamName: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textDark,
  },
  score: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.textSecondary,
    minWidth: 16,
    textAlign: 'center',
  },
  scoreLive: {
    color: colors.text,
  },
});
