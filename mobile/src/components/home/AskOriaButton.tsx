import { Pressable, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  onPress: () => void;
}

export function AskOriaButton({ onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke={colors.bg}
          strokeWidth={2}
        />
      </Svg>
      <Text style={styles.label}>Demander à Oria</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 28,
    minHeight: 56,
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: fonts.sansExtraBold,
    fontSize: 15,
    color: colors.bg,
  },
});
