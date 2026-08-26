import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CHIP_WIDTH = 52;
const CHIP_GAP = 6;

export function DateBar({ selectedDate, onDateChange }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const days = useMemo(() => {
    const result: { date: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    const now = new Date();
    for (let i = -7; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      result.push({
        date: fmtDate(d),
        dayName: i === 0
          ? 'Auj.'
          : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
        dayNum: d.getDate(),
        isToday: i === 0,
      });
    }
    return result;
  }, []);

  // Auto-scroll to center today on mount
  useEffect(() => {
    const todayIndex = days.findIndex(d => d.isToday);
    if (todayIndex >= 0 && scrollRef.current) {
      const offset = todayIndex * (CHIP_WIDTH + CHIP_GAP) - 120;
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
      }, 50);
    }
  }, [days]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {days.map(d => {
        const active = selectedDate === d.date;
        return (
          <Pressable
            key={d.date}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onDateChange(d.date)}
          >
            <Text style={[styles.dayName, active && styles.textActive]}>
              {d.dayName}
            </Text>
            <Text style={[styles.dayNum, active && styles.textActive]}>
              {d.dayNum}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    gap: CHIP_GAP,
    paddingVertical: 6,
  },
  chip: {
    width: CHIP_WIDTH,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  chipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  dayName: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  dayNum: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  textActive: {
    color: colors.primaryText,
  },
});
