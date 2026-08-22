import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/src/components/ui/Header';
import { getSubscription, listInvoices, type Subscription, type Invoice } from '@/src/api/billing';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

const PLANS = [
  { tier: 'free' as const, name: 'Free', price: '0 €/mois', features: ['5 questions/jour', 'Scores en direct', 'Suivi de 3 équipes'] },
  { tier: 'premium' as const, name: 'Premium', price: '4,99 €/mois', features: ['Questions illimitées', 'Analyses approfondies', 'Suivi illimité', 'Alertes personnalisées'] },
];

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSubscription().catch(() => null),
      listInvoices().catch(() => []),
    ]).then(([s, i]) => {
      if (s) setSub(s);
      setInvoices(i);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Abonnement" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Abonnement" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        {/* Plans */}
        <Text style={styles.sectionTitle}>PLANS</Text>
        {PLANS.map(plan => {
          const isActive = sub?.tier === plan.tier;
          return (
            <Pressable
              key={plan.tier}
              style={[styles.planCard, isActive && styles.planCardActive]}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={[styles.planPrice, isActive && styles.planPriceActive]}>{plan.price}</Text>
              </View>
              {plan.features.map((f, i) => (
                <Text key={i} style={styles.planFeature}>• {f}</Text>
              ))}
              {isActive && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Actif</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Payment method */}
        {sub?.payment_method && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>MOYEN DE PAIEMENT</Text>
            <View style={styles.paymentCard}>
              <Text style={styles.paymentBrand}>{sub.payment_method.brand}</Text>
              <Text style={styles.paymentLast4}>•••• {sub.payment_method.last4}</Text>
            </View>
          </>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>FACTURES</Text>
            {invoices.map(inv => (
              <View key={inv.id} style={styles.invoiceRow}>
                <Text style={styles.invoiceDate}>{inv.date}</Text>
                <Text style={styles.invoiceAmount}>{inv.amount} {inv.currency}</Text>
                <Text style={[styles.invoiceStatus, inv.status === 'paid' && styles.invoiceStatusPaid]}>
                  {inv.status === 'paid' ? 'Payée' : inv.status === 'pending' ? 'En attente' : 'Échouée'}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  planCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    gap: 4,
  },
  planCardActive: {
    borderColor: colors.primary,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planName: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  planPrice: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  planPriceActive: {
    color: colors.primary,
  },
  planFeature: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 20,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDark,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  activeBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.primary,
  },
  paymentCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentBrand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
    textTransform: 'capitalize',
  },
  paymentLast4: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: 10,
  },
  invoiceDate: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  invoiceAmount: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.text,
  },
  invoiceStatus: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textSubtle,
  },
  invoiceStatusPaid: {
    color: colors.success,
  },
});
