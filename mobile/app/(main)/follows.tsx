import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Image, Pressable, Switch, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { listFollows, unfollow, follow as addFollow, type Follow } from '@/src/api/follows';
import { searchCatalog, type SearchResult } from '@/src/api/catalog';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

export default function FollowsScreen() {
  const insets = useSafeAreaInsets();
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listFollows();
        if (!cancelled) { setFollows(data); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleToggle = useCallback(async (f: Follow) => {
    try {
      await unfollow(f.entity_type, f.entity_id);
      setFollows(prev => prev.filter(x => !(x.entity_type === f.entity_type && x.entity_id === f.entity_id)));
    } catch { /* ignore */ }
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchCatalog(text);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }, []);

  const handleFollow = useCallback(async (r: SearchResult) => {
    try {
      const newFollow = await addFollow(r.type, r.id, r.name, r.logo ?? r.photo);
      setFollows(prev => [...prev, newFollow]);
      setSearchResults(prev => prev.filter(x => !(x.type === r.type && x.id === r.id)));
    } catch { /* ignore */ }
  }, []);

  const leagues = follows.filter(f => f.entity_type === 'league');
  const teams = follows.filter(f => f.entity_type === 'team');
  const players = follows.filter(f => f.entity_type === 'player');

  const sections: { title: string; data: Follow[] }[] = [];
  if (leagues.length > 0) sections.push({ title: 'COMPÉTITIONS', data: leagues });
  if (teams.length > 0) sections.push({ title: 'CLUBS', data: teams });
  if (players.length > 0) sections.push({ title: 'JOUEURS', data: players });

  const flatData: ({ type: 'header'; title: string } | { type: 'follow'; follow: Follow })[] = [];
  for (const s of sections) {
    flatData.push({ type: 'header', title: s.title });
    for (const f of s.data) {
      flatData.push({ type: 'follow', follow: f });
    }
  }

  const alreadyFollowed = new Set(follows.map(f => `${f.entity_type}-${f.entity_id}`));
  const filteredResults = searchResults.filter(r => !alreadyFollowed.has(`${r.type}-${r.id}`));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Suivis" right={
        <Pressable onPress={() => setSearchMode(prev => !prev)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{searchMode ? '✕' : '+'}</Text>
        </Pressable>
      } />

      {searchMode && (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleSearch}
            placeholder="Rechercher un club, ligue, joueur…"
            placeholderTextColor={colors.textGhost}
            autoFocus
          />
          {searching && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}
          {filteredResults.map(r => (
            <Pressable key={`${r.type}-${r.id}`} style={styles.searchRow} onPress={() => handleFollow(r)}>
              {(r.logo ?? r.photo) ? (
                <Image source={{ uri: r.logo ?? r.photo }} style={[styles.logo, r.type === 'player' && styles.logoCircle]} resizeMode="contain" />
              ) : (
                <View style={[styles.monogram, r.type === 'player' && styles.logoCircle]}>
                  <Text style={styles.monogramText}>{r.name[0]}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.followName} numberOfLines={1}>{r.name}</Text>
                {r.country && <Text style={styles.searchSub}>{r.country}</Text>}
              </View>
              <Text style={styles.addLabel}>Suivre</Text>
            </Pressable>
          ))}
          {query.length >= 2 && !searching && filteredResults.length === 0 && (
            <Text style={styles.noResult}>Aucun résultat</Text>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Erreur de chargement</Text>
          <Text style={styles.emptyBody}>Impossible de charger tes suivis. Vérifie ta connexion et réessaie.</Text>
        </View>
      ) : follows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucun suivi</Text>
          <Text style={styles.emptyBody}>Ajoute des ligues, clubs ou joueurs depuis la recherche pour les retrouver ici.</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => item.type === 'header' ? `h-${item.title}` : `f-${(item as any).follow.entity_type}-${(item as any).follow.entity_id}`}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.title}</Text>;
            }
            const f = (item as { type: 'follow'; follow: Follow }).follow;
            return (
              <View style={styles.followRow}>
                {f.logo_url ? (
                  <Image source={{ uri: f.logo_url }} style={[styles.logo, f.entity_type === 'player' && styles.logoCircle]} resizeMode="contain" />
                ) : (
                  <View style={[styles.monogram, f.entity_type === 'player' && styles.logoCircle]}>
                    <Text style={styles.monogramText}>{f.entity_name[0]}</Text>
                  </View>
                )}
                <Text style={styles.followName} numberOfLines={1}>{f.entity_name}</Text>
                <Switch
                  value={true}
                  onValueChange={() => handleToggle(f)}
                  trackColor={{ false: colors.bgSurface, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 18,
  },
  sectionHeader: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    paddingVertical: 10,
    marginTop: 8,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  logoCircle: {
    borderRadius: 16,
  },
  monogram: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primary,
  },
  followName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.primary,
    marginTop: -1,
  },
  searchSection: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  searchInput: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  searchSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSubtle,
  },
  addLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  noResult: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
