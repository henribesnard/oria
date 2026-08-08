import { View, Text, Pressable, StyleSheet } from 'react-native';
import { OriaLogo } from '../OriaLogo';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';
import type { Attachment, SuggestedAction } from '@/src/api/chat';

interface Props {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  degraded?: boolean;
  attachments?: Attachment[];
  suggested_actions?: SuggestedAction[];
  onSuggestedAction?: (action: SuggestedAction) => void;
}

export function MessageBubble({ role, text, streaming, degraded, suggested_actions, onSuggestedAction }: Props) {
  if (role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <OriaLogo size={17} />
      </View>
      <View style={styles.assistantContent}>
        <View style={[styles.assistantBubble, degraded && { opacity: 0.6 }]}>
          <Text style={styles.assistantText}>{text}</Text>
          {streaming && !text && <TypingDots />}
        </View>
        {suggested_actions && suggested_actions.length > 0 && (
          <View style={styles.suggestedRow}>
            {suggested_actions.map((a, i) => (
              <Pressable key={i} onPress={() => onSuggestedAction?.(a)} style={styles.suggestedBtn}>
                <Text style={styles.suggestedText}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function TypingDots() {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    borderTopRightRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 13,
    maxWidth: '82%',
  },
  userText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: '#fff',
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  assistantContent: {
    flexDirection: 'column',
    gap: 5,
    maxWidth: '82%',
    flexShrink: 1,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  assistantText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textStrong,
  },
  suggestedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  suggestedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderFocus,
  },
  suggestedText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primaryHover,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    paddingVertical: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textGhost,
  },
});
