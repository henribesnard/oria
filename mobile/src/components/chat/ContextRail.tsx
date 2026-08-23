import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { listFollows, type Follow } from '@/src/api/follows';
import { listLiveFixtures, type Fixture } from '@/src/api/catalog';
import { PulseDot } from '../ui/PulseDot';

interface RailItem {
  key: string;
  label: string;
  logo?: string;
  entityType: 'league' | 'team' | 'player';
  entityId: number;
  isLive?: boolean;
}

interface Props {
  onSelect: (entityType: string, entityId: number, entityName: string, logo?: string) => void;
  onOpenSelector: () => void;
}

export function ContextRail({ onSelect, onOpenSelector }: Props) {
  const [items, setItems] = useState<RailItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [follows, liveFixtures] = await Promise.all([
          listFollows().catch(() => [] as Follow[]),
          listLiveFixtures().catch(() => [] as Fixture[]),
        ]);

        const liveTeamIds = new Set<number>();
        const liveLeagueIds = new Set<number>();
        for (const f of liveFixtures) {
          const status = (f.status ?? '').toUpperCase();
          if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'].includes(status)) {
            if (f.home_id) liveTeamIds.add(f.home_id);
            if (f.away_id) liveTeamIds.add(f.away_id);
            if (f.league_id) liveLeagueIds.add(f.league_id);
          }
        }

        const railItems: RailItem[] = follows.map(f => ({
          key: `${f.entity_type}-${f.entity_id}`,
          label: f.entity_name,
          logo: f.logo_url,
          entityType: f.entity_type,
          entityId: f.entity_id,
          isLive:
            f.entity_type === 'team'
              ? liveTeamIds.has(f.entity_id)
              : f.entity_type === 'league'
                ? liveLeagueIds.has(f.entity_id)
                : false,
        }));

        // Sort: live items first
        railItems.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));

        if (!cancelled) setItems(railItems);
      } catch { /* ignore */ }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {items.map(item => (
        <Pressable
          key={item.key}
          style={styles.chip}
          onPress={() => onSelect(item.entityType, item.entityId, item.label, item.logo)}
        >
          {item.logo ? (
            <View style={styles.logoWrap}>
              <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={styles.chipLabel} numberOfLines={1}>{item.label}</Text>
          {item.isLive && <PulseDot size={5} />}
        </Pressable>
      ))}

      <Pressable style={styles.frameBtn} onPress={onOpenSelector}>
        <Text style={styles.frameBtnText}>Cadrer</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  logoWrap: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 12,
    height: 12,
  },
  chipLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    color: colors.textSecondary,
    maxWidth: 90,
  },
  frameBtn: {
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 11.5,
    color: colors.primary,
  },
});
