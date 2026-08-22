import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function Header({ title, showBack = true, right }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path d="m15 18-6-6 6-6" stroke={colors.text} strokeWidth={2.2} />
            </Svg>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {right ?? <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 36,
  },
  title: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 15.5,
    color: colors.text,
  },
});
