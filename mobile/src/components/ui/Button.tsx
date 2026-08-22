import { Pressable, Text, StyleSheet, type ViewStyle, ActivityIndicator } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { radius } from '@/src/theme/spacing';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        isGhost && styles.ghost,
        pressed && !isGhost && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.bg : colors.primary} size="small" />
      ) : (
        <Text style={[
          styles.label,
          isPrimary && styles.primaryLabel,
          variant === 'secondary' && styles.secondaryLabel,
          isGhost && styles.ghostLabel,
        ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
  },
  primaryLabel: {
    color: colors.bg,
  },
  secondaryLabel: {
    color: colors.text,
  },
  ghostLabel: {
    color: colors.textSubtle,
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
  },
});
