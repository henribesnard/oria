import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Stat {
  label: string;
  value: string | number;
}

interface Props {
  stats: Stat[];
}

export function StatsGrid({ stats }: Props) {
  return (
    <View style={styles.grid}>
      {stats.map((s, i) => (
        <View key={i} style={styles.cell}>
          <Text style={styles.value}>{s.value}</Text>
          <Text style={styles.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  value: {
    fontFamily: fonts.monoBold,
    fontSize: 22,
    color: colors.text,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSubtle,
  },
});
