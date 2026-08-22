import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OriaLogo } from '@/src/components/OriaLogo';
import { Button } from '@/src/components/ui/Button';
import { useAuth } from '@/src/hooks/useAuth';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const features: [string, string][] = [
  ['Données fraîches, fraîcheur affichée', '#4FC48A'],
  ['Scores en direct sur tes équipes', '#FF8574'],
  ['Contexte cascadant, jamais imposé', '#8B7CFF'],
];

const STATS = [
  { value: '8', label: 'ligues' },
  { value: '2400+', label: 'matchs suivis' },
  { value: '2h', label: 'fraîcheur moy.' },
];

const SHOWCASE = [
  { title: 'Sélecteur de contexte', desc: 'Choisis ligue, équipe ou joueur pour cadrer ta question.', color: colors.primary },
  { title: 'Fraîcheur des données', desc: 'Chaque réponse affiche quand les données ont été mises à jour.', color: colors.successLight },
  { title: 'Cotes & tendances', desc: 'Analyse avancée avec les cotes et les tendances de forme.', color: colors.warning },
];

const LEAGUES = [
  'Ligue 1', 'Ligue 2', 'Premier League', 'Championship',
  'LaLiga', 'Serie A', 'Bundesliga', 'Champions League',
];

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enterGuest } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <OriaLogo size={38} />
          </View>
          <Text style={styles.headline}>L'oracle du sport, en langage naturel.</Text>
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

        {/* Key stats */}
        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Showcase cards */}
        <View style={styles.showcaseSection}>
          {SHOWCASE.map((item, i) => (
            <View key={i} style={styles.showcaseCard}>
              <View style={[styles.showcaseDot, { backgroundColor: item.color }]} />
              <View style={styles.showcaseContent}>
                <Text style={styles.showcaseTitle}>{item.title}</Text>
                <Text style={styles.showcaseDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Coverage */}
        <View style={styles.coverageSection}>
          <Text style={styles.coverageTitle}>Couverture</Text>
          <View style={styles.leagueChips}>
            {LEAGUES.map((l, i) => (
              <View key={i} style={styles.leagueChip}>
                <Text style={styles.leagueChipText}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaHeadline}>{"Prêt à interroger l'oracle ?"}</Text>
        </View>

        {/* CTAs */}
        <View style={[styles.ctas, { paddingBottom: insets.bottom + 16 }]}>
          <Button label="Créer un compte" onPress={() => router.push('/(auth)/register')} />
          <Button label="J'ai déjà un compte" variant="secondary" onPress={() => router.push('/(auth)/login')} />
          <Button label="Explorer sans compte" variant="ghost" onPress={() => { enterGuest(); router.replace('/(main)'); }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingTop: 20,
  },
  hero: {
    paddingHorizontal: 26,
    gap: 18,
    marginBottom: 28,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 32,
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
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.sansExtraBold,
    fontSize: 22,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  showcaseSection: {
    paddingHorizontal: 22,
    gap: 10,
    marginBottom: 24,
  },
  showcaseCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  showcaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  showcaseContent: {
    flex: 1,
    gap: 3,
  },
  showcaseTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.text,
  },
  showcaseDesc: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  coverageSection: {
    paddingHorizontal: 22,
    marginBottom: 28,
  },
  coverageTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  leagueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  leagueChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.borderFocus,
  },
  leagueChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primaryText,
  },
  ctaSection: {
    paddingHorizontal: 26,
    marginBottom: 12,
  },
  ctaHeadline: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  ctas: {
    paddingHorizontal: 22,
    gap: 10,
    paddingTop: 12,
  },
});
