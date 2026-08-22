import { View, Text, Pressable, Image, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  name: string;
  subtitle?: string;
  logoUrl?: string;
  /** 'team' | 'league' → rounded rect ; 'player' → circle */
  kind?: 'team' | 'league' | 'player';
  /** Right accessory: chevron (default), or custom node */
  right?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function EntityRow({
  name,
  subtitle,
  logoUrl,
  kind = 'team',
  right,
  showChevron = true,
  onPress,
  style,
}: Props) {
  const isPlayer = kind === 'player';
  const mono = name
    .replace(/[^A-Za-z\u00C0-\u017F0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const fallback = mono.length > 1
    ? (mono[0][0] + mono[1][0]).toUpperCase()
    : (mono[0] ?? '').slice(0, 2).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, style]}
    >
      <View style={[styles.logo, isPlayer && styles.logoPlayer]}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={[
              styles.logoImg,
              isPlayer ? styles.logoImgPlayer : styles.logoImgTeam,
            ]}
          />
        ) : (
          <Text style={styles.fallback}>{fallback}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? (showChevron ? (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Path d="m9 18 6-6-6-6" stroke={colors.textFaint} strokeWidth={2.4} />
        </Svg>
      ) : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: 56,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoPlayer: {
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoImgTeam: {
    resizeMode: 'contain',
    margin: 4,
  },
  logoImgPlayer: {
    resizeMode: 'cover',
  },
  fallback: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textGhost,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.sansBold,
    fontSize: 14.5,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textSubtle,
  },
});
