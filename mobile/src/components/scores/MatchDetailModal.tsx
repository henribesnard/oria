import { View, Text, Image, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Fixture } from '@/src/api/catalog';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  fixture: Fixture | null;
  visible: boolean;
  onClose: () => void;
  onAddToChat: (fixture: Fixture) => void;
}

function statusLabel(status?: string): string {
  const s = status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s)) return 'En direct';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'Terminé';
  return 'À venir';
}

function statusColor(status?: string) {
  const s = status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s))
    return { fg: colors.warningDark, bg: colors.warningLight };
  if (['FT', 'AET', 'PEN'].includes(s))
    return { fg: colors.textMuted, bg: colors.surfaceMuted };
  return { fg: colors.primaryHover, bg: colors.primarySurface };
}

function clockText(fixture: Fixture): string {
  const s = fixture.status?.toUpperCase() ?? '';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s))
    return fixture.elapsed ? `${fixture.elapsed}'` : 'live';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'Fin';
  try {
    return new Date(fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export function MatchDetailModal({ fixture, visible, onClose, onAddToChat }: Props) {
  const insets = useSafeAreaInsets();
  if (!fixture) return null;

  const sc = statusColor(fixture.status);
  const hasScore = fixture.score_home != null && fixture.score_away != null;
  const dateStr = (() => {
    try { return new Date(fixture.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return ''; }
  })();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Détail du match</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {/* Status badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.fg }]}>{statusLabel(fixture.status)}</Text>
            </View>
            <Text style={styles.clock}>{clockText(fixture)}</Text>
          </View>

          {/* Teams & Score */}
          <View style={styles.matchRow}>
            <View style={styles.teamCol}>
              {fixture.home_logo ? (
                <Image source={{ uri: fixture.home_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <View style={styles.teamLogoPlaceholder}>
                  <Text style={styles.placeholderText}>{fixture.home_team[0]}</Text>
                </View>
              )}
              <Text style={styles.teamName} numberOfLines={2}>{fixture.home_team}</Text>
            </View>

            <Text style={styles.scoreMain}>
              {hasScore ? `${fixture.score_home} – ${fixture.score_away}` : 'vs'}
            </Text>

            <View style={styles.teamCol}>
              {fixture.away_logo ? (
                <Image source={{ uri: fixture.away_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <View style={styles.teamLogoPlaceholder}>
                  <Text style={styles.placeholderText}>{fixture.away_team[0]}</Text>
                </View>
              )}
              <Text style={styles.teamName} numberOfLines={2}>{fixture.away_team}</Text>
            </View>
          </View>

          {/* Meta info */}
          <View style={styles.metaCard}>
            {fixture.league_name && (
              <View style={styles.metaRow}>
                {fixture.league_logo ? <Image source={{ uri: fixture.league_logo }} style={styles.metaIcon} resizeMode="contain" /> : null}
                <Text style={styles.metaLabel}>Compétition</Text>
                <Text style={styles.metaValue}>{fixture.league_name}</Text>
              </View>
            )}
            {dateStr ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{dateStr}</Text>
              </View>
            ) : null}
            {fixture.venue?.name && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Stade</Text>
                <Text style={styles.metaValue}>{fixture.venue.name}{fixture.venue.city ? `, ${fixture.venue.city}` : ''}</Text>
              </View>
            )}
            {fixture.referee && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Arbitre</Text>
                <Text style={styles.metaValue}>{fixture.referee}</Text>
              </View>
            )}
            {fixture.round && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Journée</Text>
                <Text style={styles.metaValue}>{fixture.round}</Text>
              </View>
            )}
          </View>

          {/* Add to Chat CTA */}
          <Pressable
            style={styles.addChatBtn}
            onPress={() => { onAddToChat(fixture); onClose(); }}
          >
            <Text style={styles.addChatText}>Ajouter au chat</Text>
          </Pressable>
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
    paddingHorizontal: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
  },
  clock: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  teamCol: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  teamLogo: {
    width: 48,
    height: 48,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    color: colors.primary,
  },
  teamName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  scoreMain: {
    fontFamily: fonts.monoBold,
    fontSize: 28,
    color: colors.text,
    paddingHorizontal: 12,
  },
  metaCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIcon: {
    width: 16,
    height: 16,
  },
  metaLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
    width: 85,
  },
  metaValue: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  addChatBtn: {
    backgroundColor: colors.primary,
    borderRadius: Platform.OS === 'ios' ? 13 : 24,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  addChatText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: '#fff',
  },
});
