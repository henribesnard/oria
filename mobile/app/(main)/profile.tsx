import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Header } from '@/src/components/ui/Header';
import { useAuth } from '@/src/hooks/useAuth';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const MENU_ITEMS = [
  { label: 'Suivis', route: '/(main)/follows' },
  { label: 'Alertes', route: '/(main)/notifications' },
  { label: 'Modifier le profil', route: '/(main)/edit-profile' },
  { label: 'Abonnement', route: '/(main)/billing' },
] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const initials = (user?.display_name ?? user?.email ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Profil" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.display_name ?? 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>PARAMÈTRES</Text>
        {MENU_ITEMS.map(item => (
          <Pressable
            key={item.label}
            style={styles.menuRow}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={colors.textGhost} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ))}

        {/* Sign out */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: fonts.sansBold,
    fontSize: 22,
    color: colors.primary,
  },
  userName: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.text,
  },
  userEmail: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSubtle,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  menuLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
  },
  logoutBtn: {
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 14,
  },
  logoutText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.danger,
  },
});
