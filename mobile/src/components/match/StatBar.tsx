import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  label: string;
  home: number;
  away: number;
}

export function StatBar({ label, home, away }: Props) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  const awayPct = (away / total) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.value}>{home}</Text>
      <View style={styles.barOuter}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.barRow}>
          <View style={[styles.barHome, { flex: homePct }]} />
          <View style={{ width: 2 }} />
          <View style={[styles.barAway, { flex: awayPct }]} />
        </View>
      </View>
      <Text style={styles.value}>{away}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  value: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  barOuter: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  barRow: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barHome: {
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  barAway: {
    backgroundColor: colors.textGhost,
    borderRadius: 2,
  },
});
