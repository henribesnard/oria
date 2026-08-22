import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { useAuth } from '@/src/hooks/useAuth';
import { updateProfile } from '@/src/api/settings';
import { colors } from '@/src/theme/colors';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = displayName !== (user?.display_name ?? '');

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName });
      router.back();
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Modifier le profil" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <Input
          label="Nom d'affichage"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ton nom"
          autoCapitalize="words"
        />

        <Input
          label="Email"
          value={user?.email ?? ''}
          editable={false}
          placeholder=""
        />

        <Button
          label="Enregistrer"
          onPress={handleSave}
          disabled={!dirty}
          loading={saving}
          style={styles.saveBtn}
        />
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
    paddingTop: 16,
  },
  saveBtn: {
    marginTop: 12,
  },
});
