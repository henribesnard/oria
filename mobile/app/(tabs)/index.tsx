import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OriaLogo } from '@/src/components/OriaLogo';
import { MessageBubble } from '@/src/components/chat/MessageBubble';
import { ChatComposer } from '@/src/components/chat/ChatComposer';
import { TypingIndicator } from '@/src/components/chat/TypingIndicator';
import { ContextPicker } from '@/src/components/chat/ContextPicker';
import { LiveTicker } from '@/src/components/chat/LiveTicker';
import { PulseDot } from '@/src/components/ui/PulseDot';
import { useChat, type Message } from '@/src/hooks/useChat';
import {
  clearLevel,
  EMPTY_CONTEXT_STATE,
  type ContextState,
  type Level,
} from '@/src/lib/contextRules';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface ContextLabel {
  key: string;
  label: string;
  logo?: string;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { messages, sending, setContext, send, handleSuggestedAction } = useChat();
  const [draft, setDraft] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [contextState, setContextState] = useState<ContextState>({ ...EMPTY_CONTEXT_STATE });
  const listRef = useRef<FlatList<Message>>(null);

  // Derive labels from contextState for the composer
  const contextLabels: ContextLabel[] = [];
  if (contextState.labels.league) {
    contextLabels.push({ key: 'league', label: contextState.labels.league.name, logo: contextState.labels.league.logo });
  }
  if (contextState.labels.fixture) {
    contextLabels.push({ key: 'fixture', label: `${contextState.labels.fixture.home} \u2013 ${contextState.labels.fixture.away}` });
  }
  if (contextState.labels.team) {
    contextLabels.push({ key: 'team', label: contextState.labels.team.name, logo: contextState.labels.team.logo });
  }
  if (contextState.labels.player) {
    contextLabels.push({ key: 'player', label: contextState.labels.player.name });
  }

  const handleSend = () => {
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
  };

  const handleContextSelect = useCallback((state: ContextState) => {
    setContextState(state);
    setContext(state.context);
  }, [setContext]);

  const handleRemoveContext = useCallback((key: string) => {
    const level = key as Exclude<Level, 'none'>;
    setContextState(prev => {
      const next = clearLevel(prev, level);
      setContext(next.context);
      return next;
    });
  }, [setContext]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, messages[messages.length - 1]?.text]);

  const renderItem = ({ item }: { item: Message }) => (
    <MessageBubble
      role={item.role}
      text={item.text}
      streaming={item.streaming}
      degraded={item.degraded}
      attachments={item.attachments}
      suggested_actions={item.suggested_actions}
      onSuggestedAction={handleSuggestedAction}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          {Platform.OS === 'ios' ? (
            <View style={styles.headerCenter}>
              <OriaLogo size={20} />
              <Text style={styles.headerTitleSerif}>Oria</Text>
            </View>
          ) : (
            <View style={styles.headerLeft}>
              <OriaLogo size={22} />
              <Text style={styles.headerTitleSerif}>Oria</Text>
            </View>
          )}
          <View style={styles.liveBadge}>
            <PulseDot size={6} color={colors.warning} />
            <Text style={styles.liveText}>En direct</Text>
          </View>
        </View>
      </View>

      {/* Live Ticker */}
      <LiveTicker />

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyLogo}>
            <OriaLogo size={48} color={colors.textGhost} />
          </View>
          <Text style={styles.emptyTitle}>Pose ta question</Text>
          <Text style={styles.emptySubtitle}>
            Résultats, forme, compos, cotes…{'\n'}Oria répond à partir de données à jour.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={sending && messages[messages.length - 1]?.streaming && !messages[messages.length - 1]?.text ? <TypingIndicator /> : null}
        />
      )}

      {/* Composer */}
      <View style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom + 48 : insets.bottom + 8 }}>
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          sending={sending}
          onOpenContext={() => setPickerVisible(true)}
          contextLabels={contextLabels}
          onRemoveContext={handleRemoveContext}
        />
      </View>

      {/* Context Picker */}
      <ContextPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleContextSelect}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(233,231,242,0.7)',
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: Platform.OS === 'ios' ? 'center' : 'flex-start',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitleSerif: {
    fontFamily: fonts.serif,
    fontSize: Platform.OS === 'ios' ? 22 : 24,
    color: colors.text,
  },
  liveBadge: {
    position: Platform.OS === 'ios' ? 'absolute' : 'relative',
    right: Platform.OS === 'ios' ? 0 : undefined,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...(Platform.OS === 'android' && {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.warningLight,
    }),
  },
  liveText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.warningDark,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyLogo: {
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.textDark,
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
});
