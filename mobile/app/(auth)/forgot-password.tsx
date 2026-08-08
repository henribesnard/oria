import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/reset', { email: email.trim() });
    } catch { /* always show success for security */ }
    setSent(true);
    setLoading(false);
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

        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>On t'envoie un lien de réinitialisation.</Text>

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              Si un compte existe avec cet email, tu recevras un lien de réinitialisation.
            </Text>
          </View>
        ) : (
          <>
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="toi@exemple.com" autoComplete="email" />
            <Button label="Envoyer le lien" onPress={handleSend} loading={loading} disabled={!email.trim()} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { marginBottom: 16 },
  backText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.primary },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.text, marginBottom: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, marginBottom: 22 },
  successBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 16 },
  successText: { fontFamily: fonts.sans, fontSize: 14, color: colors.success, lineHeight: 20 },
});
