import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OriaLogo } from '@/src/components/OriaLogo';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const features: [string, string][] = [
  ['Donn\u00e9es fra\u00eeches, fra\u00eecheur affich\u00e9e', '#3B9B6E'],
  ['Scores en direct sur tes \u00e9quipes', '#E0782A'],
  ['Contexte cascadant, jamais impos\u00e9', '#5B4FD6'],
];

const STATS = [
  { value: '8', label: 'ligues' },
  { value: '2400+', label: 'matchs suivis' },
  { value: '2h', label: 'fra\u00eecheur moy.' },
];

const SHOWCASE = [
  { title: 'S\u00e9lecteur de contexte', desc: 'Choisis ligue, \u00e9quipe ou joueur pour cadrer ta question.', color: colors.primary },
  { title: 'Fra\u00eecheur des donn\u00e9es', desc: 'Chaque r\u00e9ponse affiche quand les donn\u00e9es ont \u00e9t\u00e9 mises \u00e0 jour.', color: colors.success },
  { title: 'Cotes & tendances', desc: 'Analyse avanc\u00e9e avec les cotes et les tendances de forme.', color: colors.warning },
];

const LEAGUES = [
  'Ligue 1', 'Ligue 2', 'Premier League', 'Championship',
  'LaLiga', 'Serie A', 'Bundesliga', 'Champions League',
];

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            R\u00e9sultats, forme, compos, cotes et tendances \u2014 Oria r\u00e9pond \u00e0 partir de donn\u00e9es \u00e0 jour.
            Cadre ta question par ligue, match, \u00e9quipe ou joueur.
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
          <Text style={styles.ctaHeadline}>Pr\u00eat \u00e0 interroger l'oracle ?</Text>
        </View>

        {/* CTAs */}
        <View style={[styles.ctas, { paddingBottom: insets.bottom + 16 }]}>
          <Button label="Cr\u00e9er un compte" onPress={() => router.push('/(auth)/register')} />
          <Button label="J'ai d\u00e9j\u00e0 un compte" variant="secondary" onPress={() => router.push('/(auth)/login')} />
          <Button label="Explorer sans compte" variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primarySurface,
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
    color: colors.textDark,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
  },
  leagueChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primaryHover,
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
