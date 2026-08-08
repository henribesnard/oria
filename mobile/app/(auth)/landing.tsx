import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OriaLogo } from '@/src/components/OriaLogo';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const features: [string, string][] = [
  ['Données fraîches, fraîcheur affichée', '#3B9B6E'],
  ['Scores en direct sur tes équipes', '#E0782A'],
  ['Contexte cascadant, jamais imposé', '#5B4FD6'],
];

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <OriaLogo size={38} />
        </View>
        <Text style={styles.headline}>Le sport, en langage naturel.</Text>
        <Text style={styles.subtitle}>
          Résultats, forme, compos, cotes et tendances — Oria répond à partir de données à jour.
          Cadre ta question par ligue, match, équipe ou joueur.
        </Text>
        <View style={styles.features}>
          {features.map(([text, color], i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTAs */}
      <View style={[styles.ctas, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Créer un compte" onPress={() => router.push('/(auth)/register')} />
        <Button label="J'ai déjà un compte" variant="secondary" onPress={() => router.push('/(auth)/login')} />
        <Button label="Explorer sans compte" variant="ghost" onPress={() => router.replace('/(tabs)')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    gap: 18,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  features: {
    gap: 9,
    marginTop: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  featureText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.textDark,
  },
  ctas: {
    paddingHorizontal: 22,
    gap: 10,
    paddingTop: 12,
  },
});
