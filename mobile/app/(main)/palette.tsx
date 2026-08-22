import { View, Text, FlatList, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SearchInput } from '@/src/components/ui/SearchInput';
import { useSearch } from '@/src/hooks/useSearch';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import type { SearchResult } from '@/src/api/catalog';

const SHORTCUTS = [
  { label: 'Suivis', route: '/(main)/follows' },
  { label: 'Alertes', route: '/(main)/notifications' },
  { label: 'Abonnement', route: '/(main)/billing' },
  { label: 'Profil', route: '/(main)/profile' },
] as const;

export default function PaletteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { query, results, loading, search, clear } = useSearch();

  const hasResults = results.length > 0;
  const showShortcuts = !query;

  const leagues = results.filter(r => r.type === 'league');
  const teams = results.filter(r => r.type === 'team');
  const players = results.filter(r => r.type === 'player');

  const sections: { title: string; data: SearchResult[] }[] = [];
  if (leagues.length > 0) sections.push({ title: 'COMPÉTITIONS', data: leagues });
  if (teams.length > 0) sections.push({ title: 'CLUBS', data: teams });
  if (players.length > 0) sections.push({ title: 'JOUEURS', data: players });

  const flatData: ({ type: 'header'; title: string } | { type: 'result'; result: SearchResult })[] = [];
  for (const s of sections) {
    flatData.push({ type: 'header', title: s.title });
    for (const r of s.data) {
      flatData.push({ type: 'result', result: r });
    }
  }

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'league') {
      router.push({ pathname: '/(main)/chat', params: { prefill: `Infos sur ${result.name}` } });
    } else if (result.type === 'team') {
      router.push(`/(main)/team/${result.id}`);
    } else if (result.type === 'player') {
      router.push(`/(main)/player/${result.id}`);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.searchWrap}>
          <SearchInput
            value={query}
            onChangeText={search}
            placeholder="Rechercher…"
            autoFocus
          />
        </View>
      </View>

      {loading && query.length >= 2 && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      )}

      {hasResults && (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => item.type === 'header' ? `h-${item.title}` : `r-${(item as any).result.type}-${(item as any).result.id}`}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.title}</Text>;
            }
            const r = (item as { type: 'result'; result: SearchResult }).result;
            const logo = r.logo ?? r.photo;
            const isPlayer = r.type === 'player';
            return (
              <Pressable style={styles.resultRow} onPress={() => handleSelect(r)}>
                {logo ? (
                  <Image source={{ uri: logo }} style={[styles.resultLogo, isPlayer && styles.resultLogoCircle]} resizeMode="contain" />
                ) : (
                  <View style={[styles.resultMonogram, isPlayer && styles.resultLogoCircle]}>
                    <Text style={styles.resultMonogramText}>{r.name[0]}</Text>
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                  {(r.country || r.team) && (
                    <Text style={styles.resultSub} numberOfLines={1}>{r.country ?? r.team}</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!loading && query.length >= 2 && !hasResults && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucun résultat pour « {query} »</Text>
        </View>
      )}

      {showShortcuts && (
        <View style={styles.shortcuts}>
          <Text style={styles.sectionHeader}>ALLER À</Text>
          {SHORTCUTS.map(s => (
            <Pressable key={s.label} style={styles.shortcutRow} onPress={() => router.push(s.route as any)}>
              <Text style={styles.shortcutText}>{s.label}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={colors.textGhost} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flex: 1,
  },
  loadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    paddingVertical: 10,
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  resultLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  resultLogoCircle: {
    borderRadius: 16,
  },
  resultMonogram: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultMonogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primary,
  },
  resultInfo: {
    flex: 1,
    gap: 1,
  },
  resultName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  resultSub: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textSubtle,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  shortcuts: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  shortcutText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
  },
});
