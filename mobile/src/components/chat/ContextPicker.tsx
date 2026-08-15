import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, Image, Modal,
  StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLeagues, listTeams, listPlayers, listFixtures } from '@/src/api/catalog';
import type { League, Team, Player, Fixture } from '@/src/api/catalog';
import type { ChatContext } from '@/src/api/chat';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

type Step = 'league' | 'entity' | 'player';
type EntityTab = 'team' | 'match';

interface PickerItem {
  id: number;
  title: string;
  subtitle?: string;
  logo?: string;
  data: League | Team | Player | Fixture;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (ctx: ChatContext, labels: ContextLabel[]) => void;
}

export interface ContextLabel {
  key: string;
  label: string;
  logo?: string;
}

export function ContextPicker({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('league');
  const [entityTab, setEntityTab] = useState<EntityTab>('team');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PickerItem[]>([]);

  // Selection state
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);

  // Breadcrumb path
  const breadcrumb: string[] = ['Ligue'];
  if (step === 'entity' || step === 'player') breadcrumb.push(selectedLeague?.name ?? '');

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeagues();
      setItems(data.map(l => ({
        id: l.id,
        title: l.name,
        subtitle: l.country,
        logo: l.logo,
        data: l,
      })));
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  const loadEntities = useCallback(async (leagueId: number, tab: EntityTab) => {
    setLoading(true);
    try {
      if (tab === 'team') {
        const data = await listTeams(leagueId);
        setItems(data.map(t => ({
          id: t.id,
          title: t.name,
          subtitle: t.country,
          logo: t.logo,
          data: t,
        })));
      } else {
        const data = await listFixtures({ leagueId, nextCount: 20 });
        setItems(data.map(f => ({
          id: f.id,
          title: `${f.home_team} — ${f.away_team}`,
          subtitle: f.date ? new Date(f.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined,
          logo: f.league_logo,
          data: f,
        })));
      }
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  const loadPlayers = useCallback(async (teamId: number) => {
    setLoading(true);
    try {
      const data = await listPlayers(teamId);
      setItems(data.map(p => ({
        id: p.id,
        title: p.name,
        subtitle: (p as Record<string, unknown>).position as string | undefined,
        logo: p.photo,
        data: p,
      })));
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  // Load initial data
  useEffect(() => {
    if (visible) {
      setStep('league');
      setSelectedLeague(null);
      setSearch('');
      loadLeagues();
    }
  }, [visible, loadLeagues]);

  const handleSelectLeague = (league: League) => {
    setSelectedLeague(league);
    setStep('entity');
    setEntityTab('team');
    setSearch('');
    loadEntities(league.id, 'team');
  };

  const handleEntityTabChange = (tab: EntityTab) => {
    setEntityTab(tab);
    setSearch('');
    if (selectedLeague) loadEntities(selectedLeague.id, tab);
  };

  const handleSelectEntity = (item: PickerItem) => {
    if (entityTab === 'team') {
      const team = item.data as Team;
      const labels: ContextLabel[] = [
        { key: 'league', label: selectedLeague!.name, logo: selectedLeague!.logo },
        { key: 'team', label: team.name, logo: team.logo },
      ];
      onSelect({ league_id: selectedLeague!.id, team_id: team.id }, labels);
      onClose();
    } else {
      const fixture = item.data as Fixture;
      const labels: ContextLabel[] = [
        { key: 'league', label: selectedLeague!.name, logo: selectedLeague!.logo },
        { key: 'fixture', label: `${fixture.home_team} — ${fixture.away_team}` },
      ];
      onSelect({ league_id: selectedLeague!.id, fixture_id: fixture.id }, labels);
      onClose();
    }
  };

  const handleBack = () => {
    if (step === 'entity' || step === 'player') {
      setStep('league');
      setSelectedLeague(null);
      setSearch('');
      loadLeagues();
    }
  };

  const filtered = items.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase()),
  );

  const renderItem = ({ item }: { item: PickerItem }) => (
    <Pressable
      style={styles.optionRow}
      onPress={() => {
        if (step === 'league') handleSelectLeague(item.data as League);
        else handleSelectEntity(item);
      }}
    >
      {item.logo ? (
        <Image source={{ uri: item.logo }} style={styles.optionLogo} resizeMode="contain" />
      ) : (
        <View style={styles.optionMonogram}>
          <Text style={styles.monogramText}>{item.title[0]}</Text>
        </View>
      )}
      <View style={styles.optionInfo}>
        <Text style={styles.optionTitle} numberOfLines={1}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.optionSubtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>{'\u203A'}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Sélectionner un contexte</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {/* Breadcrumb */}
          <View style={styles.breadcrumb}>
            {step !== 'league' && (
              <Pressable onPress={handleBack} hitSlop={8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 18l-6-6 6-6" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            )}
            {breadcrumb.map((bc, i) => (
              <View key={i} style={styles.breadcrumbItem}>
                {i > 0 && <Text style={styles.breadcrumbSep}>{'\u203A'}</Text>}
                <Text style={[styles.breadcrumbText, i === breadcrumb.length - 1 && styles.breadcrumbActive]}>
                  {bc}
                </Text>
              </View>
            ))}
          </View>

          {/* Entity tab switcher (only on entity step) */}
          {step === 'entity' && (
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tab, entityTab === 'team' && styles.tabActive]}
                onPress={() => handleEntityTabChange('team')}
              >
                <Text style={[styles.tabText, entityTab === 'team' && styles.tabTextActive]}>Une équipe</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, entityTab === 'match' && styles.tabActive]}
                onPress={() => handleEntityTabChange('match')}
              >
                <Text style={[styles.tabText, entityTab === 'match' && styles.tabTextActive]}>Un match</Text>
              </Pressable>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>{'\u2315'}</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher\u2026"
              placeholderTextColor={colors.textDisabled}
              style={styles.searchInput}
            />
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={i => `${i.id}`}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Aucun résultat</Text>
              }
            />
          )}

          {/* Footer */}
          <View style={styles.panelFooter}>
            <Text style={styles.footerHint}>Sélection dépendante · instantané depuis le cache</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14,11,24,0.4)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  panelTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  closeBtn: {
    fontSize: 16,
    color: colors.textMuted,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbSep: {
    fontSize: 14,
    color: colors.textDisabled,
  },
  breadcrumbText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  breadcrumbActive: {
    color: colors.primary,
    fontFamily: fonts.sansBold,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 2,
    backgroundColor: '#E7E4F2',
    borderRadius: 9,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12.5,
    color: colors.textLabel,
  },
  tabTextActive: {
    color: colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  searchIcon: {
    fontSize: 16,
    color: colors.textDisabled,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  optionLogo: {
    width: 30,
    height: 30,
    borderRadius: 4,
  },
  optionMonogram: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primary,
  },
  optionInfo: {
    flex: 1,
    gap: 1,
  },
  optionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  optionSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    color: colors.textDisabled,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: 30,
  },
  panelFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  footerHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
