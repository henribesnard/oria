import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/hooks/useAuth';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

function SettingsRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const initial = (user?.display_name ?? user?.email ?? '?')[0].toUpperCase();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Veux-tu te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <LinearGradient colors={['#5B4FD6', '#8A6CF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
          <View>
            <Text style={styles.name}>{user?.display_name ?? 'Utilisateur'}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
          </View>
        </View>

        {/* Premium card */}
        <Pressable onPress={() => router.push('/(tabs)/pricing')}>
          <LinearGradient
            colors={['#5B4FD6', '#7A5CE0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}
          >
            <Text style={styles.premiumTier}>Palier Free</Text>
            <Text style={styles.premiumDesc}>
              Passe en Premium pour le direct illimité et les questions sans limite.
            </Text>
            <View style={styles.premiumBtn}>
              <Text style={styles.premiumBtnText}>Passer en Premium</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Settings */}
        <View style={styles.settingsCard}>
          <SettingsRow label="Notifications" value="Activées" onPress={() => router.push('/(tabs)/notifications')} />
          <SettingsRow label="Modifier le profil" onPress={() => router.push('/(tabs)/edit-profile')} />
          <SettingsRow label="Langue" value={user?.locale === 'en' ? 'English' : 'Français'} />
          <SettingsRow label="Fuseau" value={user?.timezone ?? 'Europe/Paris'} />
        </View>

        {/* Delete account */}
        <Pressable
          onPress={() => Alert.alert('Supprimer le compte', 'Cette action est irréversible. Toutes tes données seront supprimées.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => { /* deleteAccount then logout */ } },
          ])}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteText}>Supprimer mon compte</Text>
        </Pressable>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: 'rgba(233,231,242,0.7)',
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? fonts.sansBold : fonts.sansExtraBold,
    fontSize: Platform.OS === 'ios' ? 16 : 20,
    color: colors.text,
    textAlign: Platform.OS === 'ios' ? 'center' : 'left',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 100,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: '#fff',
  },
  name: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  email: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  premiumCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  premiumTier: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
  },
  premiumDesc: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 19,
  },
  premiumBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  premiumBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primaryHover,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  rowLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textStrong,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    color: colors.textDisabled,
  },
  logoutBtn: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  logoutText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.danger,
  },
  deleteBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F5D0CE',
    borderRadius: 16,
  },
  deleteText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.danger,
  },
});
