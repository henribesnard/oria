import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, Animated, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLeagues, type League } from '@/src/api/catalog';
import { follow } from '@/src/api/follows';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const { width: SCREEN_W } = Dimensions.get('window');

interface ChipItem {
  name: string;
  type: 'league';
  id: number;
  logo?: string;
}

const STEPS = [
  {
    title: 'Scores en direct,\nanalyses à la demande.',
    desc: 'Suis tes matchs en temps réel et pose tes questions en langage naturel.',
    cta: 'Commencer',
  },
  {
    title: 'Qui suis-tu ?',
    desc: 'Choisis les ligues qui t\'intéressent pour personnaliser ton expérience.',
    cta: 'Continuer',
  },
  {
    title: 'Demande à Oria.',
    desc: 'Pose n\'importe quelle question sur un match, une équipe ou un joueur. Oria répond avec des données fraîches.',
    cta: 'Entrer dans Oria',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [chips, setChips] = useState<ChipItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const leagues = await listLeagues();
        const items: ChipItem[] = leagues.slice(0, 8).map(l => ({
          name: l.name,
          type: 'league',
          id: l.id,
          logo: l.logo,
        }));
        setChips(items);
      } catch { /* ignore */ }
    })();
  }, []);

  const animateStep = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const toggle = (name: string) => {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleNext = async () => {
    if (step < 2) {
      // On step 1 (league selection), save follows before moving on
      if (step === 1) {
        const selectedChips = chips.filter(c => selected[c.name]);
        if (selectedChips.length > 0) {
          setSaving(true);
          for (const c of selectedChips) {
            try {
              await follow(c.type, c.id, c.name, c.logo);
            } catch { /* ignore individual failures */ }
          }
          setSaving(false);
        }
      }
      animateStep(step + 1);
    } else {
      router.replace('/(main)');
    }
  };

  const handleSkip = () => {
    router.replace('/(main)');
  };

  const currentStep = STEPS[step];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
        {/* Step 0: Demo match card */}
        {step === 0 && (
          <View style={styles.demoSection}>
            <View style={styles.demoCard}>
              <Text style={styles.demoLeague}>LIGUE 1 — J12</Text>
              <View style={styles.demoTeams}>
                <View style={styles.demoTeam}>
                  <View style={styles.demoCrest} />
                  <Text style={styles.demoTeamName}>PSG</Text>
                </View>
                <Text style={styles.demoScore}>2 — 1</Text>
                <View style={styles.demoTeam}>
                  <View style={styles.demoCrest} />
                  <Text style={styles.demoTeamName}>OL</Text>
                </View>
              </View>
              <View style={styles.demoLiveBadge}>
                <View style={styles.demoLiveDot} />
                <Text style={styles.demoLiveText}>67'</Text>
              </View>
            </View>
          </View>
        )}

        {/* Step 1: League chips */}
        {step === 1 && (
          <View style={styles.chipSection}>
            <View style={styles.chipGrid}>
              {chips.map((c, i) => {
                const on = selected[c.name];
                return (
                  <Pressable
                    key={i}
                    onPress={() => toggle(c.name)}
                    style={[styles.chip, on && styles.chipActive]}
                  >
                    {c.logo ? (
                      <Image source={{ uri: c.logo }} style={styles.chipLogo} resizeMode="contain" />
                    ) : null}
                    <Text style={[styles.chipName, on && styles.chipNameActive]}>{c.name}</Text>
                    <Text style={[styles.chipToggle, on && styles.chipToggleActive]}>
                      {on ? '✓' : '＋'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 2: Chat demo */}
        {step === 2 && (
          <View style={styles.chatDemo}>
            <View style={styles.chatBubbleUser}>
              <Text style={styles.chatBubbleUserText}>Pourquoi le PSG domine ?</Text>
            </View>
            <View style={styles.chatBubbleOria}>
              <Text style={styles.chatBubbleOriaText}>
                Le PSG mène 2-1 grâce à un pressing haut efficace (68% possession) et deux buts sur contre-attaque rapide...
              </Text>
            </View>
          </View>
        )}

        {/* Title + desc */}
        <View style={styles.textSection}>
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.desc}>{currentStep.desc}</Text>
        </View>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={currentStep.cta} onPress={handleNext} loading={saving} />
        <Button label="Passer" variant="ghost" onPress={handleSkip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  // Step 0 — demo card
  demoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  demoCard: {
    width: SCREEN_W * 0.75,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    transform: [{ rotate: '-3deg' }],
  },
  demoLeague: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
  },
  demoTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  demoTeam: {
    alignItems: 'center',
    gap: 6,
  },
  demoCrest: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
  },
  demoTeamName: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.text,
  },
  demoScore: {
    fontFamily: fonts.monoBold,
    fontSize: 28,
    color: colors.text,
  },
  demoLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.liveSurface,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  demoLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  demoLiveText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.liveLight,
  },
  // Step 1 — chips
  chipSection: {
    marginBottom: 32,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  chipLogo: { width: 20, height: 20, borderRadius: 10 },
  chipName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13.5,
    color: colors.textMuted,
  },
  chipNameActive: {
    color: colors.primaryText,
  },
  chipToggle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  chipToggleActive: {
    color: colors.primaryText,
  },
  // Step 2 — chat demo
  chatDemo: {
    marginBottom: 32,
    gap: 10,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '80%',
  },
  chatBubbleUserText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.bg,
  },
  chatBubbleOria: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '88%',
  },
  chatBubbleOriaText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  // Text section
  textSection: {
    gap: 8,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.text,
    lineHeight: 36,
  },
  desc: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textGhost,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
});
