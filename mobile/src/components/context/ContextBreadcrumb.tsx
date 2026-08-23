import { View, Text, Pressable, Image, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export interface Crumb {
  label: string;
  /** Logo/crest URL to display in the chip */
  crest?: string | null;
  /** Whether the crest is circular (player photo) vs rounded rect (team/league logo) */
  crestCircle?: boolean;
  /** Navigate to this crumb's level */
  onPress?: () => void;
  /** Remove this crumb (clear this selection and deeper ones) */
  onRemove?: () => void;
}

interface Props {
  crumbs: Crumb[];
  /** Ghost label for the next expected level (e.g. "Compétition", "Affiche") */
  nextLabel?: string | null;
  onClose?: () => void;
}

export function ContextBreadcrumb({ crumbs, nextLabel, onClose }: Props) {
  return (
    <View style={styles.row}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Pressable
              key={i}
              onPress={c.onPress}
              disabled={!c.onPress}
              style={[styles.chip, isLast ? styles.chipActive : styles.chipInactive]}
            >
              {c.crest ? (
                <Image
                  source={{ uri: c.crest }}
                  style={[styles.crest, c.crestCircle ? styles.crestCircle : styles.crestRect]}
                  resizeMode="contain"
                />
              ) : null}
              <Text
                style={[styles.chipLabel, isLast ? styles.chipLabelActive : styles.chipLabelInactive]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
              {isLast && c.onRemove ? (
                <Pressable onPress={c.onRemove} hitSlop={6} style={styles.removeBtn}>
                  <Text style={styles.removeText}>{'\u2715'}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {nextLabel ? (
          <View style={styles.nextLabelWrap}>
            <Text style={styles.nextLabel}>{nextLabel}</Text>
          </View>
        ) : null}
      </ScrollView>

      {onClose ? (
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6L6 18M6 6l12 12" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingRight: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 10,
  },
  chipActive: {
    backgroundColor: colors.primaryDark,
  },
  chipInactive: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  crest: {
    width: 20,
    height: 20,
  },
  crestRect: {
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  crestCircle: {
    borderRadius: 10,
  },
  chipLabel: {
    fontFamily: fonts.sansSemiBold,
    maxWidth: 100,
  },
  chipLabelActive: {
    fontSize: 12.5,
    fontFamily: fonts.sansBold,
    color: colors.primaryText,
  },
  chipLabelInactive: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  removeBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 9.5,
    color: colors.primaryText,
    lineHeight: 12,
  },
  nextLabelWrap: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  nextLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12.5,
    color: colors.text,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
