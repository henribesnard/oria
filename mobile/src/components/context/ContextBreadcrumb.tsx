import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Crumb {
  label: string;
  onPress?: () => void;
}

interface Props {
  crumbs: Crumb[];
  onBack?: () => void;
}

export function ContextBreadcrumb({ crumbs, onBack }: Props) {
  return (
    <View style={styles.row}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      )}
      {crumbs.map((c, i) => (
        <View key={i} style={styles.crumbItem}>
          {i > 0 && <Text style={styles.sep}>{'\u203A'}</Text>}
          <Pressable onPress={c.onPress} disabled={!c.onPress}>
            <Text
              style={[styles.label, i === crumbs.length - 1 && styles.labelActive]}
              numberOfLines={1}
            >
              {c.label}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  backBtn: {
    marginRight: 2,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sep: {
    fontSize: 14,
    color: colors.textDisabled,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.sansBold,
  },
});
