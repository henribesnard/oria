import { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLeagues, type League } from '@/src/api/catalog';
import { follow } from '@/src/api/follows';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface ChipItem {
  name: string;
  type: 'league' | 'team' | 'player';
  id: number;
  logo?: string;
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chips, setChips] = useState<ChipItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

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

  const toggle = (name: string) => {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFinish = async () => {
    setSaving(true);
    const selectedChips = chips.filter(c => selected[c.name]);
    for (const c of selectedChips) {
      try {
        await follow(c.type, c.id, c.name, c.logo);
      } catch { /* ignore individual failures */ }
    }
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>Dernière étape</Text>
        <Text style={styles.title}>Choisis ce que tu suis</Text>
        <Text style={styles.subtitle}>On personnalise tes réponses et tes alertes.</Text>

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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Terminer" onPress={handleFinish} loading={saving} />
        <Button label="Passer" variant="ghost" onPress={handleSkip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  step: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySurface,
  },
  chipLogo: { width: 20, height: 20, borderRadius: 10 },
  chipName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  chipNameActive: {
    color: colors.primaryHover,
  },
  chipToggle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipToggleActive: {
    color: colors.primaryHover,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
});
