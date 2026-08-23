import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="player/[id]" />
      <Stack.Screen name="search" options={{ animation: 'fade' }} />
      <Stack.Screen name="follows" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen
        name="chat"
        options={{
          presentation: 'transparentModal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
