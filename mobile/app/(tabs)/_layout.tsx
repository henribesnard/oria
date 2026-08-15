import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { TabIcon } from '@/src/components/TabIcon';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textPale,
        tabBarLabelStyle: {
          fontFamily: fonts.sansSemiBold,
          fontSize: 10,
        },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderMuted,
            backgroundColor: 'transparent',
            elevation: 0,
          },
          android: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 8,
            height: 64,
            paddingBottom: 8,
            paddingTop: 4,
          },
        }),
        ...(Platform.OS === 'ios' && {
          tabBarBackground: () => (
            <BlurView
              intensity={85}
              tint="systemChromeMaterialLight"
              style={StyleSheet.absoluteFill}
            />
          ),
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Oria',
          tabBarIcon: ({ focused, color }) => <TabIcon name="chat" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="scores"
        options={{
          title: 'Scores',
          tabBarIcon: ({ focused, color }) => <TabIcon name="scores" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="follows"
        options={{
          title: 'Suivis',
          tabBarIcon: ({ focused, color }) => <TabIcon name="follows" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color }) => <TabIcon name="profile" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="pricing"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
