import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
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
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosContainer}>
        {tabs.map(t => {
          const active = t.key === selected;
          return (
            <Pressable key={t.key} onPress={() => onSelect(t.key)} style={[styles.iosTab, active && styles.iosTabActive]}>
              <Text style={[styles.iosLabel, active && styles.iosLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // Android: underline tabs
  return (
    <View style={styles.androidContainer}>
      {tabs.map(t => {
        const active = t.key === selected;
        return (
          <Pressable key={t.key} onPress={() => onSelect(t.key)} style={[styles.androidTab, active && styles.androidTabActive]}>
            <Text style={[styles.androidLabel, active && styles.androidLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // iOS segmented control
  iosContainer: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: '#E7E4F2',
    borderRadius: 9,
    padding: 3,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
  },
  iosTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
  },
  iosTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  iosLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textLabel,
  },
  iosLabelActive: {
    color: colors.text,
  },

  // Android underline tabs
  androidContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 2,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  androidTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  androidTabActive: {
    borderBottomColor: colors.primary,
  },
  androidLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  androidLabelActive: {
    color: colors.primary,
  },
});
