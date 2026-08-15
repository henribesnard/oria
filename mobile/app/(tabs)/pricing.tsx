import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { getSubscription, listInvoices, cancelSubscription, type Subscription, type Invoice } from '@/src/api/billing';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const FREE_FEATURES = [
  'Questions journalières (quota Free)',
  'R\u00e9sultats, classements, calendrier',
  'S\u00e9lecteur de contexte',
  'Fra\u00eecheur des donn\u00e9es affich\u00e9e',
];

const PREMIUM_FEATURES = [
  'Questions illimit\u00e9es',
  'Scores en direct',
  'Compositions probables',
  'Cotes, tendances, analyse avanc\u00e9e',
  'Alertes personnalis\u00e9es',
];

const FAQ = [
  {
    q: 'Puis-je annuler \u00e0 tout moment ?',
    a: 'Oui, tu peux annuler ton abonnement Premium \u00e0 tout moment depuis ton profil. Tu conserveras l\u2019acc\u00e8s jusqu\u2019\u00e0 la fin de la p\u00e9riode de facturation.',
  },
  {
    q: 'Les donn\u00e9es sont-elles \u00e0 jour ?',
    a: 'Oria utilise des sources actualis\u00e9es en continu. La fra\u00eecheur est affich\u00e9e sur chaque r\u00e9ponse.',
  },
  {
    q: 'Quelles ligues sont couvertes ?',
    a: 'Ligue 1, Ligue 2, Premier League, Championship, LaLiga, Serie A, Bundesliga, Champions League, et plus.',
  },
  {
    q: 'Comment fonctionne le palier Free ?',
    a: 'Le palier Free te donne acc\u00e8s \u00e0 un quota journalier de questions avec les r\u00e9sultats, classements et le calendrier.',
  },
];

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function PricingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const loadBilling = useCallback(async () => {
    try {
      const [sub, inv] = await Promise.all([getSubscription(), listInvoices()]);
      setSubscription(sub);
      setInvoices(inv);
    } catch {
      // Defaults for when billing is not set up
      setSubscription({ tier: 'free', status: 'active' });
      setInvoices([]);
    }
  }, []);

  useEffect(() => { loadBilling(); }, [loadBilling]);

  const handleCancel = () => {
    Alert.alert('Annuler l\u2019abonnement', 'Tu conserveras l\u2019acc\u00e8s jusqu\u2019\u00e0 la fin de la p\u00e9riode.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler', style: 'destructive', onPress: async () => {
        try { await cancelSubscription(); loadBilling(); } catch { /* ignore */ }
      }},
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Abonnement</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Free tier */}
        <View style={styles.tierCard}>
          <Text style={styles.tierName}>Free</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>0\u20AC</Text>
            <Text style={styles.priceUnit}> / mois</Text>
          </View>
          <View style={styles.featureList}>
            {FREE_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <CheckIcon />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Palier actuel</Text>
          </View>
        </View>

        {/* Premium tier */}
        <View style={styles.premiumWrapper}>
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Recommand\u00e9</Text>
          </View>
          <LinearGradient
            colors={['#5B4FD6', '#7A5CE0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}
          >
            <Text style={styles.premiumName}>Premium</Text>
            <View style={styles.priceRow}>
              <Text style={styles.premiumPrice}>7,99\u20AC</Text>
              <Text style={styles.premiumPriceUnit}> / mois</Text>
            </View>
            <View style={styles.featureList}>
              {PREMIUM_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 13l4 4L19 7" stroke="rgba(255,255,255,0.9)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.premiumFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Passer en Premium</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Payment method & invoices (visible for premium users) */}
        {subscription?.payment_method && (
          <View style={styles.billingSection}>
            <Text style={styles.billingSectionTitle}>Moyen de paiement</Text>
            <View style={styles.paymentCard}>
              <Text style={styles.paymentBrand}>{subscription.payment_method.brand.toUpperCase()}</Text>
              <Text style={styles.paymentLast4}>{'\u2022\u2022\u2022\u2022 '}{subscription.payment_method.last4}</Text>
            </View>
            {subscription.tier === 'premium' && (
              <Pressable onPress={handleCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Annuler l'abonnement</Text>
              </Pressable>
            )}
          </View>
        )}

        {invoices.length > 0 && (
          <View style={styles.billingSection}>
            <Text style={styles.billingSectionTitle}>Historique des factures</Text>
            <View style={styles.invoiceCard}>
              {invoices.map((inv, i) => (
                <View key={inv.id} style={[styles.invoiceRow, i > 0 && styles.invoiceRowBorder]}>
                  <Text style={styles.invoiceDate}>{new Date(inv.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  <Text style={styles.invoiceAmount}>{inv.amount} {inv.currency === 'eur' ? '\u20AC' : inv.currency}</Text>
                  <View style={[styles.invoiceStatusBadge, { backgroundColor: inv.status === 'paid' ? colors.successLight : colors.warningLight }]}>
                    <Text style={[styles.invoiceStatusText, { color: inv.status === 'paid' ? colors.success : colors.warning }]}>
                      {inv.status === 'paid' ? 'Pay\u00e9' : inv.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* FAQ */}
        <Text style={styles.faqTitle}>Questions fr\u00e9quentes</Text>
        {FAQ.map((item, i) => (
          <View key={i} style={styles.faqCard}>
            <Text style={styles.faqQuestion}>{item.q}</Text>
            <Text style={styles.faqAnswer}>{item.a}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: 'rgba(233,231,242,0.7)',
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? fonts.sansBold : fonts.sansExtraBold,
    fontSize: Platform.OS === 'ios' ? 16 : 20,
    color: colors.text,
    textAlign: 'center',
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 100,
  },
  tierCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  tierName: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: 14,
  },
  price: {
    fontFamily: fonts.sansExtraBold,
    fontSize: 28,
    color: colors.text,
  },
  priceUnit: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
  },
  featureList: {
    gap: 8,
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.textDark,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  currentBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  premiumWrapper: {
    marginBottom: 24,
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginBottom: -8,
    marginLeft: 14,
    zIndex: 1,
  },
  recommendedText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  premiumCard: {
    borderRadius: 18,
    padding: 18,
    paddingTop: 22,
  },
  premiumName: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: '#fff',
  },
  premiumPrice: {
    fontFamily: fonts.sansExtraBold,
    fontSize: 28,
    color: '#fff',
  },
  premiumPriceUnit: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  premiumFeatureText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.9)',
  },
  upgradeBtn: {
    backgroundColor: '#fff',
    borderRadius: Platform.OS === 'ios' ? 13 : 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  upgradeBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.primaryHover,
  },
  billingSection: {
    marginBottom: 24,
  },
  billingSectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  paymentBrand: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.textDark,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  paymentLast4: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textSecondary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F5D0CE',
    borderRadius: 14,
  },
  cancelBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.danger,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  invoiceRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  invoiceDate: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textDark,
    flex: 1,
  },
  invoiceAmount: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.text,
    marginRight: 10,
  },
  invoiceStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  invoiceStatusText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
  },
  faqTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  faqCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  faqQuestion: {
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
    color: colors.text,
    marginBottom: 6,
  },
  faqAnswer: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
