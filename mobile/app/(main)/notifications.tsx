import { View, Text, Switch, ScrollView, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { getNotificationSettings, updateNotificationSettings, type NotificationSettings } from '@/src/api/settings';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const TOGGLES: { key: keyof Omit<NotificationSettings, 'quiet_start' | 'quiet_end' | 'timezone'>; label: string; desc: string }[] = [
  { key: 'prematch', label: 'Avant-match', desc: 'Notification 1h avant le coup d\'envoi' },
  { key: 'result', label: 'Résultat final', desc: 'Score final de tes matchs suivis' },
  { key: 'lineup', label: 'Compositions', desc: 'Quand les compos officielles tombent' },
  { key: 'live_goal', label: 'Buts en direct', desc: 'Alerte immédiate sur chaque but' },
  { key: 'digest', label: 'Résumé quotidien', desc: 'Récap des scores du jour à 22h' },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    getNotificationSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await updateNotificationSettings({ [key]: value });
    } catch {
      setSettings(settings); // revert
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Alertes" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        {TOGGLES.map(t => (
          <View key={t.key} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>{t.label}</Text>
              <Text style={styles.rowDesc}>{t.desc}</Text>
            </View>
            <Switch
              value={settings?.[t.key] ?? false}
              onValueChange={(v) => handleToggle(t.key, v)}
              trackColor={{ false: colors.bgSurface, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 18,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  rowLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  rowDesc: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textSubtle,
  },
});
