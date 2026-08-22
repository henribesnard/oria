import { View, TextInput, Pressable, StyleSheet, type TextInputProps } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
}

export function SearchInput({ value, onChangeText, onClear, ...rest }: Props) {
  return (
    <View style={styles.container}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={styles.icon}>
        <Circle cx={11} cy={11} r={7} stroke={colors.textSubtle} strokeWidth={2.2} />
        <Path d="m20 20-4.3-4.3" stroke={colors.textSubtle} strokeWidth={2.2} />
      </Svg>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textGhost}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {value.length > 0 && onClear && (
        <Pressable onPress={onClear} hitSlop={8} style={styles.clearBtn}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6 6 18M6 6l12 12" stroke={colors.textGhost} strokeWidth={2.2} />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 15,
    minHeight: 50,
  },
  icon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 13,
  },
  clearBtn: {
    padding: 4,
  },
});
