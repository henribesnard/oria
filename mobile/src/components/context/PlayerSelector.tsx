import { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { getSquad, type Player } from '@/src/api/catalog';
import { SearchInput } from '../ui/SearchInput';
import { EmptyState } from './EmptyState';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];
const POSITION_LABELS: Record<string, string> = {
  Goalkeeper: 'GARDIENS',
  Defender: 'DÉFENSEURS',
  Midfielder: 'MILIEUX',
  Attacker: 'ATTAQUANTS',
};

interface Props {
  teamId: number;
  onSelectPlayer: (player: Player) => void;
  /** Called when the user opts to stay at team level instead of picking a player */
  onStayAtTeam?: () => void;
}

export function PlayerSelector({ teamId, onSelectPlayer, onStayAtTeam }: Props) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getSquad(teamId);
        if (!cancelled) setPlayers(data);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [teamId]);

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = search
    ? players.filter(p => normalize(p.name).includes(normalize(search)))
    : players;

  // Group by position
  const grouped: { position: string; label: string; data: Player[] }[] = [];
  for (const pos of POSITION_ORDER) {
    const inPos = filtered.filter(p => p.position === pos);
    if (inPos.length > 0) {
      grouped.push({ position: pos, label: POSITION_LABELS[pos] ?? pos.toUpperCase(), data: inPos });
    }
  }
  // Players without a known position
  const unknown = filtered.filter(p => !POSITION_ORDER.includes(p.position ?? ''));
  if (unknown.length > 0) {
    grouped.push({ position: 'other', label: 'AUTRES', data: unknown });
  }

  // Flatten for FlatList
  const flatData: ({ type: 'header'; label: string } | { type: 'player'; player: Player })[] = [];
  for (const g of grouped) {
    flatData.push({ type: 'header', label: g.label });
    for (const p of g.data) {
      flatData.push({ type: 'player', player: p });
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (players.length === 0) {
    return (
      <View style={styles.noSquad}>
        <Text style={styles.noSquadTitle}>Effectif non publié.</Text>
        <Text style={styles.noSquadBody}>
          Le fournisseur ne donne pas la liste des joueurs pour cette équipe. Les trois premiers niveaux restent utilisables.
        </Text>
        {onStayAtTeam ? (
          <Pressable style={styles.noSquadBtn} onPress={onStayAtTeam}>
            <Text style={styles.noSquadBtnText}>Rester au niveau équipe</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Rechercher un joueur…" />
      </View>

      <FlatList
        data={flatData}
        keyExtractor={(item, i) => item.type === 'header' ? `h-${item.label}` : `p-${(item as any).player.id}`}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={styles.sectionHeader}>{item.label}</Text>;
          }
          const p = (item as { type: 'player'; player: Player }).player;
          return (
            <Pressable style={styles.playerRow} onPress={() => onSelectPlayer(p)}>
              {p.number != null && (
                <Text style={styles.number}>{p.number}</Text>
              )}
              {p.photo ? (
                <Image source={{ uri: p.photo }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitial}>{p.name[0]}</Text>
                </View>
              )}
              <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Aucun joueur trouvé" />}
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
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    paddingVertical: 8,
    marginTop: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  number: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSubtle,
    width: 22,
    textAlign: 'center',
  },
  photo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  photoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primary,
  },
  playerName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  noSquad: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    gap: 9,
  },
  noSquadTitle: {
    fontFamily: fonts.serif,
    fontSize: 23,
    color: colors.text,
    lineHeight: 28,
  },
  noSquadBody: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.textSubtle,
  },
  noSquadBtn: {
    alignSelf: 'flex-start',
    height: 40,
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 15,
    justifyContent: 'center',
    marginTop: 6,
  },
  noSquadBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12.5,
    color: colors.primaryText,
  },
});
