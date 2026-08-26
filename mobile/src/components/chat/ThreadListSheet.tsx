import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, Pressable, Modal,
  ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { listThreads, deleteThread, type ThreadSummary } from '@/src/api/chat';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (thread: ThreadSummary) => void;
}

function timeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'hier';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function ThreadListSheet({ visible, onClose, onSelect }: Props) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    listThreads()
      .then(setThreads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const handleDelete = useCallback((threadId: string) => {
    Alert.alert(
      'Supprimer la conversation',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteThread(threadId)
              .then(() => setThreads(prev => prev.filter(t => t.id !== threadId)))
              .catch(() => {});
          },
        },
      ],
    );
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mes conversations</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={t => t.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => { onSelect(item); onClose(); }}
                onLongPress={() => handleDelete(item.id)}
                delayLongPress={500}
              >
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title || 'Conversation'}
                  </Text>
                  {item.last_message ? (
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {item.last_message}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.rowTime}>{timeAgo(item.updated_at)}</Text>
              </Pressable>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Aucune conversation</Text>
              </View>
            }
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
    maxHeight: '75%',
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
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
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  rowPreview: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSubtle,
  },
  rowTime: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSubtle,
  },
});
