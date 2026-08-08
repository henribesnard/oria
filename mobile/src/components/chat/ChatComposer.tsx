import { View, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
}

export function ChatComposer({ value, onChangeText, onSend, sending }: Props) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Pressable style={styles.addBtn}>
          <View style={styles.addIcon}>
            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <Path d="M7 1v12M1 7h12" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={canSend ? onSend : undefined}
          placeholder="Pose ta question…"
          placeholderTextColor={colors.textDisabled}
          returnKeyType="send"
          style={styles.input}
          multiline={false}
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[styles.sendBtn, { backgroundColor: canSend ? colors.primary : colors.textGhost }]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12h13M12 5l7 7-7 7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 12,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(246,246,251,0.9)' : colors.surface,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: Platform.OS === 'ios' ? 20 : 26,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 6,
    shadowColor: 'rgba(38,32,74,0.2)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
    minHeight: 34,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
