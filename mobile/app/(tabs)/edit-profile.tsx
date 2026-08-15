import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/hooks/useAuth';
import { updateProfile, changePassword } from '@/src/api/settings';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const LOCALES = [
  { label: 'Fran\u00e7ais', value: 'fr' },
  { label: 'English', value: 'en' },
  { label: 'Espa\u00f1ol', value: 'es' },
];

const TIMEZONES = ['Europe/Paris', 'Europe/London', 'America/New_York'];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState(user?.display_name ?? '');
  const [locale, setLocale] = useState(user?.locale ?? 'fr');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Europe/Paris');
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const initial = (name || user?.email || '?')[0].toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: name, locale, timezone });
      Alert.alert('Profil mis \u00e0 jour', 'Tes modifications ont \u00e9t\u00e9 enregistr\u00e9es.');
      router.back();
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre \u00e0 jour le profil.');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPw.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caract\u00e8res.');
      return;
    }
    try {
      await changePassword({ current_password: currentPw, new_password: newPw });
      Alert.alert('Mot de passe modifi\u00e9', 'Ton mot de passe a \u00e9t\u00e9 chang\u00e9.');
      setShowPassword(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch {
      Alert.alert('Erreur', 'Mot de passe actuel incorrect.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarRow}>
          <LinearGradient colors={['#5B4FD6', '#8A6CF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
        </View>

        {/* Fields */}
        <Text style={styles.fieldLabel}>Nom</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Ton nom" placeholderTextColor={colors.textDisabled} />

        <Text style={styles.fieldLabel}>Email</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.inputDisabledText}>{user?.email ?? ''}</Text>
        </View>

        <Text style={styles.fieldLabel}>Langue</Text>
        <View style={styles.optionGroup}>
          {LOCALES.map(l => (
            <Pressable key={l.value} style={[styles.optionBtn, locale === l.value && styles.optionBtnActive]} onPress={() => setLocale(l.value)}>
              <Text style={[styles.optionBtnText, locale === l.value && styles.optionBtnTextActive]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Fuseau horaire</Text>
        <View style={styles.optionGroup}>
          {TIMEZONES.map(tz => (
            <Pressable key={tz} style={[styles.optionBtn, timezone === tz && styles.optionBtnActive]} onPress={() => setTimezone(tz)}>
              <Text style={[styles.optionBtnText, timezone === tz && styles.optionBtnTextActive]}>{tz.split('/')[1]?.replace('_', ' ') ?? tz}</Text>
            </Pressable>
          ))}
        </View>

        {/* Save */}
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
          <Text style={styles.saveBtnText}>{saving ? 'Enregistrement\u2026' : 'Enregistrer'}</Text>
        </Pressable>

        {/* Password section */}
        <View style={styles.separator} />

        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}>
          <Text style={styles.passwordToggleText}>Changer le mot de passe</Text>
          <Text style={styles.chevron}>{showPassword ? '\u2303' : '\u203A'}</Text>
        </Pressable>

        {showPassword && (
          <View style={styles.passwordSection}>
            <TextInput
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
              placeholder="Mot de passe actuel"
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
            />
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              placeholder="Nouveau mot de passe"
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
            />
            <TextInput
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
            />
            <Pressable onPress={handleChangePassword} style={styles.changePwBtn}>
              <Text style={styles.changePwBtnText}>Modifier le mot de passe</Text>
            </Pressable>
          </View>
        )}
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: '#fff',
  },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 14,
    marginLeft: 2,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
  },
  inputDisabledText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionBtnActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderFocus,
  },
  optionBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textDark,
  },
  optionBtnTextActive: {
    fontFamily: fonts.sansBold,
    color: colors.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: Platform.OS === 'ios' ? 13 : 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  saveBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: '#fff',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  passwordToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  passwordToggleText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textStrong,
  },
  chevron: {
    fontSize: 18,
    color: colors.textDisabled,
  },
  passwordSection: {
    marginTop: 12,
    gap: 10,
  },
  changePwBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: Platform.OS === 'ios' ? 13 : 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  changePwBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.textStrong,
  },
});
