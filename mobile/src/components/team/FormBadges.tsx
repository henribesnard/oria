import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import type { Fixture } from '@/src/api/catalog';
import { FINISHED } from '@/src/lib/contextRules';

interface Props {
  fixtures: Fixture[];
  teamId: number;
}

type Result = 'W' | 'D' | 'L';

function getResult(f: Fixture, teamId: number): Result | null {
  if (!FINISHED.includes((f.status ?? '').toUpperCase())) return null;
  if (f.score_home == null || f.score_away == null) return null;
  const isHome = f.home_id === teamId;
  const own = isHome ? f.score_home : f.score_away;
  const opp = isHome ? f.score_away : f.score_home;
  if (own > opp) return 'W';
  if (own < opp) return 'L';
  return 'D';
}

const RESULT_COLORS: Record<Result, string> = {
  W: colors.formWin,
  D: colors.formDraw,
  L: colors.formLoss,
};

const RESULT_LABELS: Record<Result, string> = {
  W: 'V',
  D: 'N',
  L: 'D',
};

export function FormBadges({ fixtures, teamId }: Props) {
  const results = fixtures
    .map(f => getResult(f, teamId))
    .filter((r): r is Result => r !== null)
    .slice(0, 5);

  if (results.length === 0) return null;

  return (
    <View style={styles.row}>
      {results.map((r, i) => (
        <View key={i} style={[styles.badge, { backgroundColor: RESULT_COLORS[r] }]}>
          <Text style={styles.badgeText}>{RESULT_LABELS[r]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.white,
  },
});
