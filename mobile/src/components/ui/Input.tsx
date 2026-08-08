import { View, Text, TextInput, StyleSheet, Platform, type TextInputProps } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props extends TextInputProps {
  label: string;
}

export function Input({ label, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDisabled}
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
    color: colors.textDark,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: Platform.OS === 'ios' ? 12 : 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
});
