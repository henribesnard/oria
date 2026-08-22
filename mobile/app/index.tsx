import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';
import { colors } from '@/src/theme/colors';

export default function Index() {
  const { user, loading, guest } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user || guest) {
    return <Redirect href="/(main)" />;
  }

  return <Redirect href="/(auth)/landing" />;
}
