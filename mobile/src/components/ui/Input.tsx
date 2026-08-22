import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { radius } from '@/src/theme/spacing';

interface Props extends TextInputProps {
  label: string;
}

export function Input({ label, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textGhost}
        style={styles.input}
        autoCapitalize="none"
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 13,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bgSurface,
  },
});
