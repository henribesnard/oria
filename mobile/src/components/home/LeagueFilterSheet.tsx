import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, Pressable, Image, Modal,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { listLeagues, type League } from '@/src/api/catalog';
import { SearchInput } from '../ui/SearchInput';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const POPULAR_COUNTRIES = [
  { label: 'France', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { label: 'Angleterre', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { label: 'Espagne', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { label: 'Italie', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
  { label: 'Allemagne', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { label: 'Portugal', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
];

export interface SelectedLeague {
  id: number;
  name: string;
  country: string;
  logo?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (league: SelectedLeague | null) => void;
}

interface CountryItem {
  name: string;
  count: number;
}

export function LeagueFilterSheet({ visible, onClose, onSelect }: Props) {
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Load leagues on first open
  useEffect(() => {
    if (!visible || allLeagues.length > 0) return;
    setLoading(true);
    listLeagues()
      .then(setAllLeagues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, allLeagues.length]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedCountry(null);
      setSearch('');
    }
  }, [visible]);

  const normalize = useCallback((s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  []);

  // Country list with league count
  const countries = useMemo<CountryItem[]>(() => {
    const map = new Map<string, number>();
    allLeagues.forEach(l => {
      const c = l.country ?? 'Autre';
      map.set(c, (map.get(c) ?? 0) + 1);
    });
    // Popular first, then alphabetical
    const popular = POPULAR_COUNTRIES
      .filter(p => map.has(p.label))
      .map(p => ({ name: p.label, count: map.get(p.label) ?? 0 }));
    const popularNames = new Set(popular.map(p => p.name));
    const others = Array.from(map.entries())
      .filter(([name]) => !popularNames.has(name))
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...popular, ...others];
  }, [allLeagues]);

  // Filtered countries (when searching in country mode)
  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const q = normalize(search);
    return countries.filter(c => normalize(c.name).includes(q));
  }, [countries, search, normalize]);

  // Leagues for selected country
  const leaguesForCountry = useMemo(() => {
    if (!selectedCountry) return [];
    let filtered = allLeagues.filter(l => l.country === selectedCountry);
    if (search) {
      const q = normalize(search);
      filtered = filtered.filter(l => normalize(l.name).includes(q));
    }
    return filtered;
  }, [allLeagues, selectedCountry, search, normalize]);

  const handleSelectLeague = useCallback((league: League) => {
    onSelect({
      id: league.id,
      name: league.name,
      country: league.country,
      logo: league.logo,
    });
    onClose();
  }, [onSelect, onClose]);

  const handleClearFilter = useCallback(() => {
    onSelect(null);
    onClose();
  }, [onSelect, onClose]);

  const handleBack = useCallback(() => {
    setSelectedCountry(null);
    setSearch('');
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          {selectedCountry ? (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ) : null}
          <Text style={styles.title}>
            {selectedCountry ?? 'Filtrer par ligue'}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder={selectedCountry ? 'Rechercher une ligue...' : 'Rechercher un pays...'}
          />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : selectedCountry ? (
          /* League list for selected country */
          <FlatList
            data={leaguesForCountry}
            keyExtractor={l => String(l.id)}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => handleSelectLeague(item)}>
                {item.logo ? (
                  <View style={styles.logoWrap}>
                    <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={styles.monogram}>
                    <Text style={styles.monogramText}>{(item.name)[0]}</Text>
                  </View>
                )}
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          /* Country list */
          <FlatList
            data={[{ name: '__all__', count: 0 }, ...filteredCountries]}
            keyExtractor={c => c.name}
            renderItem={({ item }) => {
              if (item.name === '__all__') {
                return (
                  <Pressable style={styles.allRow} onPress={handleClearFilter}>
                    <Text style={styles.allRowText}>Toutes les ligues</Text>
                  </Pressable>
                );
              }
              const popular = POPULAR_COUNTRIES.find(p => p.label === item.name);
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => { setSelectedCountry(item.name); setSearch(''); }}
                >
                  {popular ? (
                    <Text style={styles.flag}>{popular.flag}</Text>
                  ) : (
                    <View style={styles.flagPlaceholder} />
                  )}
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowCount}>{item.count}</Text>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke={colors.textSubtle} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  allRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  allRowText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  flag: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  flagPlaceholder: {
    width: 26,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.bgSurface,
  },
  logoWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 20,
    height: 20,
  },
  monogram: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.primary,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  rowCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSubtle,
  },
});
