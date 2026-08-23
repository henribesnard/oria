import { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { searchCatalog, type SearchResult } from '@/src/api/catalog';
import { follow as addFollow } from '@/src/api/follows';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const SHORTCUTS = [
  { label: 'Suivis', route: '/(main)/follows' },
  { label: 'Alertes', route: '/(main)/notifications' },
  { label: 'Abonnement', route: '/(main)/billing' },
  { label: 'Profil', route: '/(main)/profile' },
] as const;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchCatalog(text);
        setResults(data);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, []);

  const handleSelect = (r: SearchResult) => {
    if (r.type === 'league') {
      router.push({ pathname: '/(main)/chat', params: { prefill: `Infos sur ${r.name}` } });
    } else if (r.type === 'team') {
      router.push(`/(main)/team/${r.id}`);
    } else if (r.type === 'player') {
      router.push(`/(main)/player/${r.id}`);
    }
  };

  const handleFollow = useCallback(async (r: SearchResult) => {
    try {
      await addFollow(r.type, r.id, r.name, r.logo ?? r.photo);
    } catch { /* ignore */ }
  }, []);

  const leagues = results.filter(r => r.type === 'league');
  const teams = results.filter(r => r.type === 'team');
  const players = results.filter(r => r.type === 'player');

  const sections: { title: string; data: SearchResult[] }[] = [];
  if (leagues.length > 0) sections.push({ title: 'COMPETITIONS', data: leagues });
  if (teams.length > 0) sections.push({ title: 'CLUBS', data: teams });
  if (players.length > 0) sections.push({ title: 'JOUEURS', data: players });

  type FlatItem = { type: 'header'; title: string } | { type: 'result'; result: SearchResult };
  const flatData: FlatItem[] = [];
  for (const s of sections) {
    flatData.push({ type: 'header', title: s.title });
    for (const r of s.data) {
      flatData.push({ type: 'result', result: r });
    }
  }

  const hasResults = results.length > 0;
  const showShortcuts = !query;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Rechercher..."
          placeholderTextColor={colors.textGhost}
          autoFocus
          returnKeyType="search"
        />
      </View>

      {loading && query.length >= 2 && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      )}

      {hasResults && (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => item.type === 'header' ? `h-${item.title}` : `r-${(item as { type: 'result'; result: SearchResult }).result.type}-${(item as { type: 'result'; result: SearchResult }).result.id}`}
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
                <Pressable onPress={() => handleFollow(r)} style={styles.followBtn} hitSlop={8}>
                  <Text style={styles.followBtnText}>Suivre</Text>
                </Pressable>
              </Pressable>
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!loading && query.length >= 2 && !hasResults && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucun resultat pour "{query}"</Text>
        </View>
      )}

      {showShortcuts && (
        <View style={styles.shortcuts}>
          <Text style={styles.sectionHeader}>ALLER A</Text>
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
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
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
  followBtn: {
    backgroundColor: colors.primarySurface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  followBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.primary,
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
