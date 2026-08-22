import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { OriaLogo } from '../OriaLogo';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

function AnimatedDot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.25, { duration: 300 }),
        ),
        -1,
      ),
    );
  }, [delay, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
}

export function TypingIndicator() {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <OriaLogo size={17} />
      </View>
      <View style={styles.bubble}>
        <Animated.Text style={styles.label}>Oria consulte le direct</Animated.Text>
        <View style={styles.dotsContainer}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={200} />
          <AnimatedDot delay={400} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textGhost,
  },
});
