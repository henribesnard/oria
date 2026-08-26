import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
import { ThreadListSheet } from '@/src/components/chat/ThreadListSheet';
import { createThread, type ThreadSummary } from '@/src/api/chat';
import {
  type ContextLabel,
  type ContextState,
  EMPTY_CONTEXT_STATE,
  selectLeague,
  selectFixture,
  selectTeam,
  clearLevel,
  deepestLevel,
} from '@/src/lib/contextRules';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefill?: string;
    fixtureId?: string;
    fixtureHome?: string;
    fixtureAway?: string;
    fixtureHomeId?: string;
    fixtureAwayId?: string;
    fixtureHomeLogo?: string;
    fixtureAwayLogo?: string;
    leagueId?: string;
    leagueName?: string;
    leagueLogo?: string;
    leagueCountry?: string;
    fixtureStatus?: string;
    fixtureRound?: string;
  }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [input, setInput] = useState(params.prefill ?? '');
  const [ctxState, setCtxState] = useState<ContextState>(EMPTY_CONTEXT_STATE);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [threadListVisible, setThreadListVisible] = useState(false);
  const [displayTitle, setDisplayTitle] = useState('');

  const {
    messages, sending, setContext, send, handleSuggestedAction,
    threadId, setThreadId, switchThread, historyLoaded,
  } = useChat(ctxState.context);

  // Sync context to useChat when ctxState changes
  useEffect(() => {
    setContext(ctxState.context);
  }, [ctxState, setContext]);

  // Generate title from current context labels
  const contextTitle = useMemo(() => {
    if (ctxState.labels.fixture) {
      return `${ctxState.labels.fixture.home} - ${ctxState.labels.fixture.away}`;
    }
    if (ctxState.labels.team) return ctxState.labels.team.name;
    if (ctxState.labels.league) return ctxState.labels.league.name;
    return '';
  }, [ctxState.labels]);

  // Initialize context from navigation params (e.g. from home screen match)
  const contextInitRef = useRef(false);
  useEffect(() => {
    if (contextInitRef.current || !params.fixtureId) return;
    contextInitRef.current = true;
    let state = EMPTY_CONTEXT_STATE;
    if (params.leagueId) {
      state = selectLeague(state, {
        id: Number(params.leagueId),
        name: params.leagueName ?? '',
        logo: params.leagueLogo,
        country: params.leagueCountry,
      });
    }
    state = selectFixture(state, {
      id: Number(params.fixtureId),
      home: params.fixtureHome ?? '',
      away: params.fixtureAway ?? '',
      homeId: params.fixtureHomeId ? Number(params.fixtureHomeId) : undefined,
      awayId: params.fixtureAwayId ? Number(params.fixtureAwayId) : undefined,
      homeLogo: params.fixtureHomeLogo,
      awayLogo: params.fixtureAwayLogo,
      status: params.fixtureStatus,
      round: params.fixtureRound,
    });
    setCtxState(state);

    // Auto-create thread for fixture context
    const title = `${params.fixtureHome ?? ''} - ${params.fixtureAway ?? ''}`;
    setDisplayTitle(title);
    createThread(title, state.context)
      .then(({ id }) => setThreadId(id))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send prefill — wait for thread when opening with fixture params
  const prefillSent = useRef(false);
  useEffect(() => {
    if (!params.prefill || prefillSent.current) return;
    if (params.fixtureId && !threadId) return; // wait for thread creation
    prefillSent.current = true;
    send(params.prefill, threadId);
    setInput('');
  }, [params.prefill, params.fixtureId, threadId, send]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    if (!threadId) {
      // Auto-create thread on first message
      const title = contextTitle || text.slice(0, 40);
      setDisplayTitle(title);
      try {
        const { id } = await createThread(
          title,
          Object.keys(ctxState.context).length > 0 ? ctxState.context : undefined,
        );
        setThreadId(id);
        send(text, id);
      } catch {
        send(text);
      }
    } else {
      send(text);
    }
  }, [input, send, threadId, setThreadId, contextTitle, ctxState.context]);

  const handleNewThread = useCallback(() => {
    switchThread(undefined);
    setCtxState(EMPTY_CONTEXT_STATE);
    setDisplayTitle('');
  }, [switchThread]);

  const handleSelectThread = useCallback((thread: ThreadSummary) => {
    switchThread(thread.id);
    setDisplayTitle(thread.title || 'Conversation');
    setCtxState(EMPTY_CONTEXT_STATE);
  }, [switchThread]);

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

  // Context summary for context chip
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

  // Header title
  const headerTitle = displayTitle || (threadId ? 'Conversation' : 'Nouvelle conversation');

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

        {/* Thread header */}
        <View style={styles.threadHeader}>
          <Pressable onPress={() => setThreadListVisible(true)} style={styles.headerBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M3 12h18M3 18h18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>

          <Text style={styles.threadTitle} numberOfLines={1}>{headerTitle}</Text>

          <Pressable onPress={handleNewThread} style={styles.headerBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
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
            !historyLoaded ? (
              <View style={styles.empty}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Pose ta question</Text>
                <Text style={styles.emptyBody}>
                  {"Oria analyse le match en direct, les stats et l'historique pour te r\u00E9pondre."}
                </Text>
              </View>
            )
          }
          style={styles.list}
          keyboardDismissMode="on-drag"
        />

        {/* Context Rail */}
        <ContextRail onSelect={handleRailSelect} onOpenSelector={handleOpenSelector} hasContext={contextLabels.length > 0} />

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

      <ThreadListSheet
        visible={threadListVisible}
        onClose={() => setThreadListVisible(false)}
        onSelect={handleSelectThread}
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
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadTitle: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: 8,
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
