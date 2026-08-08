import { Pressable, Text, StyleSheet, Platform, type ViewStyle, ActivityIndicator } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

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
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} size="small" />
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
    borderRadius: Platform.OS === 'ios' ? 13 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  secondary: {
    backgroundColor: '#fff',
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
    color: '#fff',
  },
  secondaryLabel: {
    color: colors.textStrong,
  },
  ghostLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
  },
});
