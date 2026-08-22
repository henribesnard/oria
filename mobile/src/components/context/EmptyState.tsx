import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

interface Props {
  title?: string;
  body?: string;
}

export function EmptyState({ title = 'Aucun résultat', body }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 18,
  },
});
