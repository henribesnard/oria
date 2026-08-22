import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/hooks/useAuth';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      if (raw.includes('401')) {
        setError('Email ou mot de passe incorrect');
      } else if (raw.includes('500') || raw.includes('internal_error')) {
        setError('Le serveur a rencontré un problème. Réessaie plus tard.');
      } else if (raw.includes('Network') || raw.includes('fetch')) {
        setError('Impossible de joindre le serveur. Vérifie ta connexion.');
      } else {
        setError('Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.body}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Retour</Text>
        </Pressable>

        <Text style={styles.title}>Bon retour</Text>
        <Text style={styles.subtitle}>Reprends là où tu t'es arrêté.</Text>

        {/* OAuth */}
        <View style={styles.oauthSection}>
          <Pressable style={styles.oauthBtn}>
            <Text style={styles.oauthGlyph}>G</Text>
            <Text style={styles.oauthLabel}>Continuer avec Google</Text>
          </Pressable>
          <Pressable style={styles.oauthBtn}>
            <Text style={styles.oauthGlyph}>{'\uF8FF'}</Text>
            <Text style={styles.oauthLabel}>Continuer avec Apple</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="toi@exemple.com" autoComplete="email" />
        <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" autoComplete="password" />

        <Button label="Se connecter" onPress={handleLogin} loading={loading} disabled={!email.trim() || !password} />

        <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn}>
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.footerText}>
          Pas de compte ?{' '}
        </Text>
        <Pressable onPress={() => router.replace('/(auth)/register')}>
          <Text style={styles.footerLink}>Créer un compte</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { marginBottom: 16 },
  backText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.primary },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.text, marginBottom: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, marginBottom: 22 },
  oauthSection: { gap: 10, marginBottom: 6 },
  oauthBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 14,
  },
  oauthGlyph: { fontFamily: fonts.monoBold, fontWeight: '700', color: colors.primary },
  oauthLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textDisabled },
  errorBox: { backgroundColor: 'rgba(213,68,59,0.12)', borderWidth: 1, borderColor: 'rgba(213,68,59,0.3)', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.dangerLight },
  forgotBtn: { alignSelf: 'center', paddingTop: 14 },
  forgotText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.primary },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12 },
  footerText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  footerLink: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primary },
});
