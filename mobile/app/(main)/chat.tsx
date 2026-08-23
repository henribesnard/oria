import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import { useChat, type Message } from '@/src/hooks/useChat';
import { MessageBubble } from '@/src/components/chat/MessageBubble';
import { ChatComposer } from '@/src/components/chat/ChatComposer';
import { ContextRail } from '@/src/components/chat/ContextRail';
import { ContextSelector } from '@/src/components/context/ContextSelector';
import {
  type ContextLabel,
  type ContextState,
  EMPTY_CONTEXT_STATE,
  selectLeague,
  selectTeam,
  clearLevel,
  deepestLevel,
} from '@/src/lib/contextRules';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ prefill?: string }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [input, setInput] = useState(params.prefill ?? '');
  const [ctxState, setCtxState] = useState<ContextState>(EMPTY_CONTEXT_STATE);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const { messages, sending, setContext, send, handleSuggestedAction } = useChat(ctxState.context);

  // Sync context to useChat when ctxState changes
  useEffect(() => {
    setContext(ctxState.context);
  }, [ctxState, setContext]);

  // Auto-send prefill on mount
  const prefillSent = useRef(false);
  useEffect(() => {
    if (params.prefill && !prefillSent.current) {
      prefillSent.current = true;
      send(params.prefill);
      setInput('');
    }
  }, [params.prefill, send]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    send(input.trim());
    setInput('');
  }, [input, send]);

  const contextLabels = useMemo<ContextLabel[]>(() => {
    const labels: ContextLabel[] = [];
    if (ctxState.labels.league) {
      labels.push({ key: 'league', label: ctxState.labels.league.name, logo: ctxState.labels.league.logo });
    }
    if (ctxState.labels.fixture) {
      const fx = ctxState.labels.fixture;
      labels.push({ key: 'fixture', label: `${fx.home} - ${fx.away}` });
    }
    if (ctxState.labels.team) {
      labels.push({ key: 'team', label: ctxState.labels.team.name, logo: ctxState.labels.team.logo });
    }
    if (ctxState.labels.player) {
      labels.push({ key: 'player', label: ctxState.labels.player.name });
    }
    return labels;
  }, [ctxState.labels]);

  const handleRemoveContext = useCallback((key: string) => {
    const level = key as 'league' | 'fixture' | 'team' | 'player';
    setCtxState(prev => clearLevel(prev, level));
  }, []);

  const handleRailSelect = useCallback((entityType: string, entityId: number, entityName: string, logo?: string) => {
    if (entityType === 'league') {
      setCtxState(prev => selectLeague(prev, { id: entityId, name: entityName, logo }));
    } else if (entityType === 'team') {
      setCtxState(prev => selectTeam(prev, { id: entityId, name: entityName, logo }));
    }
  }, []);

  const handleOpenSelector = useCallback(() => {
    setSelectorVisible(true);
  }, []);

  const handleApplyContext = useCallback((state: ContextState) => {
    setCtxState(state);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Context summary for header
  const contextSummary = useMemo(() => {
    const level = deepestLevel(ctxState);
    if (level === 'none') return null;
    const labels = ctxState.labels;
    if (labels.player) return { label: labels.player.name, logo: labels.team?.logo };
    if (labels.team) return { label: labels.team.name, logo: labels.team.logo };
    if (labels.fixture) return { label: `${labels.fixture.home} - ${labels.fixture.away}`, logo: labels.league?.logo };
    if (labels.league) return { label: labels.league.name, logo: labels.league.logo };
    return null;
  }, [ctxState]);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={[styles.sheet, { paddingBottom: insets.bottom }]}
      >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Context header */}
        <View style={styles.contextHeader}>
          {contextSummary ? (
            <Pressable style={styles.contextChip} onPress={handleOpenSelector}>
              {contextSummary.logo ? (
                <View style={styles.contextLogoWrap}>
                  <Image source={{ uri: contextSummary.logo }} style={styles.contextLogo} resizeMode="contain" />
                </View>
              ) : null}
              <Text style={styles.contextChipText} numberOfLines={1}>{contextSummary.label}</Text>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke={colors.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ) : (
            <Pressable style={styles.contextChipEmpty} onPress={handleOpenSelector}>
              <Text style={styles.contextChipEmptyText}>Général</Text>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke={colors.textGhost} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          )}
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => (
            <MessageBubble
              role={item.role}
              text={item.text}
              streaming={item.streaming}
              degraded={item.degraded}
              suggested_actions={item.suggested_actions}
              onSuggestedAction={handleSuggestedAction}
            />
          )}
          contentContainerStyle={styles.messageList}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Pose ta question</Text>
              <Text style={styles.emptyBody}>
                Oria analyse le match en direct, les stats et l'historique pour te répondre.
              </Text>
            </View>
          }
          style={styles.list}
          keyboardDismissMode="on-drag"
        />

        {/* Context Rail */}
        <ContextRail onSelect={handleRailSelect} onOpenSelector={handleOpenSelector} />

        {/* Composer */}
        <ChatComposer
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          sending={sending}
          onOpenContext={handleOpenSelector}
          contextLabels={contextLabels}
          onRemoveContext={handleRemoveContext}
        />
      </KeyboardAvoidingView>

      <ContextSelector
        visible={selectorVisible}
        onClose={() => setSelectorVisible(false)}
        onApply={handleApplyContext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '75%',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contextHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 10,
  },
  contextLogoWrap: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contextLogo: {
    width: 14,
    height: 14,
  },
  contextChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primaryText,
    maxWidth: 200,
  },
  contextChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  contextChipEmptyText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textGhost,
  },
  list: {
    flex: 1,
  },
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 20,
  },
});
