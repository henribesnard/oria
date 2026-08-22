import { ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  chips: string[];
  onPress: (text: string) => void;
}

export function QuickAskChips({ chips, onPress }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map(text => (
        <Pressable key={text} onPress={() => onPress(text)} style={styles.chip}>
          <Text style={styles.label}>{text}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
