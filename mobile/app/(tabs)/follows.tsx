import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Pressable, ScrollView, RefreshControl, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listFollows, unfollow, type Follow } from '@/src/api/follows';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const SECTIONS: { title: string; type: Follow['entity_type'] }[] = [
  { title: 'Équipes', type: 'team' },
  { title: 'Ligues', type: 'league' },
  { title: 'Joueurs', type: 'player' },
];

export default function FollowsScreen() {
  const insets = useSafeAreaInsets();
  const [follows, setFollows] = useState<Follow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listFollows();
      setFollows(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleUnfollow = async (entityType: string, entityId: number) => {
    try {
      await unfollow(entityType, entityId);
      setFollows(prev => prev.filter(f => !(f.entity_type === entityType && f.entity_id === entityId)));
    } catch { /* ignore */ }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes suivis</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {SECTIONS.map(({ title, type }) => {
          const items = follows.filter(f => f.entity_type === type);
          if (items.length === 0) return null;
          return (
            <View key={type} style={styles.section}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.chipGrid}>
                {items.map(f => (
                  <View key={`${f.entity_type}-${f.entity_id}`} style={styles.chip}>
                    {f.logo_url ? (
                      <Image source={{ uri: f.logo_url }} style={styles.chipLogo} resizeMode="contain" />
                    ) : null}
                    <Text style={styles.chipName}>{f.entity_name}</Text>
                    <Pressable onPress={() => handleUnfollow(f.entity_type, f.entity_id)} hitSlop={8}>
                      <Text style={styles.chipRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {follows.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>Aucun suivi</Text>
            <Text style={styles.emptySubtitle}>Ajoute des équipes, ligues ou joueurs pour personnaliser ton expérience.</Text>
          </View>
        )}
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
    paddingTop: 14,
    paddingBottom: 100,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingLeft: 9,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLogo: { width: 20, height: 20 },
  chipName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textDark,
  },
  chipRemove: {
    fontSize: 11,
    color: colors.textDisabled,
    marginLeft: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.textDark,
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 30,
  },
});
