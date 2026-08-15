import { useState, useEffect, useCallback } from 'react';
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
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s)) {
    return fixture.elapsed ? `${fixture.elapsed}'` : 'live';
  }
  if (['FT', 'AET', 'PEN'].includes(s)) return 'Fin';
  try {
    return new Date(fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function abbreviate(name: string): string {
  if (name.length <= 3) return name.toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

export function LiveTicker() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await listLiveFixtures();
      setFixtures(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const liveAndUpcoming = fixtures.filter(f => {
    const cls = classifyStatus(f.status);
    return cls === 'live' || cls === 'pre';
  }).slice(0, 15);

  if (liveAndUpcoming.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {liveAndUpcoming.map(f => {
        const cls = classifyStatus(f.status);
        const clock = clockLabel(f);
        const isLive = cls === 'live';
        const hasScore = f.score_home != null && f.score_away != null;

        return (
          <View key={f.id} style={styles.item}>
            <View style={styles.teamRow}>
              {f.home_logo ? <Image source={{ uri: f.home_logo }} style={styles.logo} resizeMode="contain" /> : null}
              <Text style={styles.abbr}>{abbreviate(f.home_team)}</Text>
              <Text style={[styles.score, isLive && styles.scoreLive]}>
                {hasScore ? `${f.score_home}` : '–'}
              </Text>
            </View>
            <View style={styles.center}>
              <Text style={[styles.clock, isLive && styles.clockLive]}>{clock}</Text>
            </View>
            <View style={styles.teamRow}>
              <Text style={[styles.score, isLive && styles.scoreLive]}>
                {hasScore ? `${f.score_away}` : '–'}
              </Text>
              <Text style={styles.abbr}>{abbreviate(f.away_team)}</Text>
              {f.away_logo ? <Image source={{ uri: f.away_logo }} style={styles.logo} resizeMode="contain" /> : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    width: 16,
    height: 16,
  },
  abbr: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textDark,
  },
  score: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 10,
    textAlign: 'center',
  },
  scoreLive: {
    color: colors.text,
  },
  center: {
    paddingHorizontal: 4,
  },
  clock: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    color: colors.textFaint,
    textAlign: 'center',
  },
  clockLive: {
    color: colors.warning,
  },
});
