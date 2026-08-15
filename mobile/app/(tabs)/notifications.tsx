import { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Pressable } from 'react-native';
import { getNotificationSettings, updateNotificationSettings, type NotificationSettings } from '@/src/api/settings';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const TOGGLES: { key: keyof Pick<NotificationSettings, 'prematch' | 'result' | 'lineup' | 'live_goal' | 'digest'>; label: string; desc: string }[] = [
  { key: 'prematch', label: 'Rappel avant match', desc: '2h avant le coup d\u2019envoi' },
  { key: 'result', label: 'Résultat final', desc: 'À la fin du match' },
  { key: 'lineup', label: 'Compositions', desc: '~1h avant le coup d\u2019envoi' },
  { key: 'live_goal', label: 'But en direct', desc: 'Buts de tes équipes suivies' },
  { key: 'digest', label: 'Digest quotidien', desc: 'Résumé chaque matin' },
];

const QUIET_OPTIONS = [
  { label: 'Aucune', value: null },
  { label: '23:00 – 08:00', value: '23:00-08:00' },
  { label: '00:00 – 07:00', value: '00:00-07:00' },
];

const TIMEZONE_OPTIONS = ['Europe/Paris', 'Europe/London', 'America/New_York'];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch {
      // Use defaults if endpoint not available
      setSettings({
        prematch: true,
        result: true,
        lineup: false,
        live_goal: true,
        digest: true,
        quiet_start: '23:00',
        quiet_end: '08:00',
        timezone: 'Europe/Paris',
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try { await updateNotificationSettings({ [key]: value }); }
    catch { /* revert on error */ setSettings(settings); }
  };

  const handleQuietChange = async (option: typeof QUIET_OPTIONS[number]) => {
    if (!settings) return;
    const parts = option.value?.split('-') ?? [null, null];
    const updated = { ...settings, quiet_start: parts[0], quiet_end: parts[1] };
    setSettings(updated);
    try { await updateNotificationSettings({ quiet_start: parts[0], quiet_end: parts[1] }); }
    catch { setSettings(settings); }
  };

  const handleTimezoneChange = async (tz: string) => {
    if (!settings) return;
    const updated = { ...settings, timezone: tz };
    setSettings(updated);
    try { await updateNotificationSettings({ timezone: tz }); }
    catch { setSettings(settings); }
  };

  const currentQuiet = settings?.quiet_start && settings?.quiet_end
    ? `${settings.quiet_start} \u2013 ${settings.quiet_end}`
    : 'Aucune';

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notification toggles */}
        <View style={styles.card}>
          {TOGGLES.map(({ key, label, desc }, i) => (
            <View key={key} style={[styles.toggleRow, i > 0 && styles.toggleBorder]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Text style={styles.toggleDesc}>{desc}</Text>
              </View>
              <Switch
                value={settings?.[key] ?? false}
                onValueChange={(v) => handleToggle(key, v)}
                trackColor={{ false: colors.borderMuted, true: colors.primaryMuted }}
                thumbColor={settings?.[key] ? colors.primary : colors.surfaceCard}
              />
            </View>
          ))}
        </View>

        {/* Quiet hours */}
        <Text style={styles.sectionTitle}>Heures silencieuses</Text>
        <View style={styles.card}>
          {QUIET_OPTIONS.map((opt) => {
            const selected = opt.value
              ? opt.value === `${settings?.quiet_start}-${settings?.quiet_end}`
              : !settings?.quiet_start;
            return (
              <Pressable
                key={opt.label}
                style={[styles.optionRow, selected && styles.optionSelected]}
                onPress={() => handleQuietChange(opt)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt.label}</Text>
                {selected && (
                  <View style={styles.checkDot} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Timezone */}
        <Text style={styles.sectionTitle}>Fuseau horaire</Text>
        <View style={styles.card}>
          {TIMEZONE_OPTIONS.map((tz) => {
            const selected = tz === settings?.timezone;
            return (
              <Pressable
                key={tz}
                style={[styles.optionRow, selected && styles.optionSelected]}
                onPress={() => handleTimezoneChange(tz)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{tz}</Text>
                {selected && <View style={styles.checkDot} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: 'rgba(233,231,242,0.7)',
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? fonts.sansBold : fonts.sansExtraBold,
    fontSize: Platform.OS === 'ios' ? 16 : 20,
    color: colors.text,
    textAlign: 'center',
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  toggleBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textStrong,
  },
  toggleDesc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  optionSelected: {
    backgroundColor: colors.primarySurface,
  },
  optionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textStrong,
  },
  optionTextSelected: {
    color: colors.primary,
    fontFamily: fonts.sansBold,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
