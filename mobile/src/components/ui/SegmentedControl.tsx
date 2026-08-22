import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Tab {
  key: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  selected: string;
  onSelect: (key: string) => void;
}

export function SegmentedControl({ tabs, selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map(t => {
        const active = t.key === selected;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: colors.bgElevated,
    borderRadius: 13,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textSubtle,
  },
  labelActive: {
    color: colors.primaryText,
    fontFamily: fonts.sansBold,
  },
});
