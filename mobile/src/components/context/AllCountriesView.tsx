import { useState, useEffect } from 'react';
import { View, Text, SectionList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { listLeagues, type League } from '@/src/api/catalog';
import { SearchInput } from '../ui/SearchInput';
import { EmptyState } from './EmptyState';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface CountryGroup {
  country: string;
  flag?: string;
  count: number;
}

interface Props {
  onSelectCountry: (country: string) => void;
}

export function AllCountriesView({ onSelectCountry }: Props) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const leagues = await listLeagues();
        const map = new Map<string, { flag?: string; count: number }>();
        for (const l of leagues) {
          const c = l.country ?? 'Autre';
          const existing = map.get(c);
          if (existing) {
            existing.count++;
          } else {
            map.set(c, { flag: l.country_flag, count: 1 });
          }
        }
        const groups = Array.from(map.entries())
          .map(([country, { flag, count }]) => ({ country, flag, count }))
          .sort((a, b) => a.country.localeCompare(b.country));
        if (!cancelled) setCountries(groups);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = search
    ? countries.filter(c => normalize(c.country).includes(normalize(search)))
    : countries;

  // Group by first letter
  const sections: { title: string; data: CountryGroup[] }[] = [];
  for (const c of filtered) {
    const letter = c.country[0]?.toUpperCase() ?? '#';
    const existing = sections.find(s => s.title === letter);
    if (existing) {
      existing.data.push(c);
    } else {
      sections.push({ title: letter, data: [c] });
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Rechercher un pays…" />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.country}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelectCountry(item.country)}>
            {item.flag ? (
              <View style={styles.flagWrap}>
                <SvgUri uri={item.flag} width={22} height={16} />
              </View>
            ) : (
              <View style={styles.flagPlaceholder} />
            )}
            <Text style={styles.name} numberOfLines={1}>{item.country}</Text>
            <Text style={styles.count}>{item.count}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title="Aucun pays trouvé" />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  searchWrap: {
    paddingHorizontal: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.textDisabled,
    paddingVertical: 6,
    marginTop: 8,
    backgroundColor: colors.bgElevated,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  flagWrap: {
    width: 26,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    overflow: 'hidden',
  },
  flagPlaceholder: {
    width: 26,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.bgSurface,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSubtle,
  },
});
