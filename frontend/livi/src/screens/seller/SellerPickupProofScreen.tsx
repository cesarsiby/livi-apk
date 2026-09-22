import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { sellerApi, type DeliveryProof } from '../../features/seller/sellerApi';
import {
  Button,
  Card,
  ProofDisplay,
  Screen,
  Skeleton,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function SellerPickupProofScreen({ route }: any) {
  const orderId = String(route?.params?.orderId ?? '');

  const [proof, setProof] = useState<DeliveryProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      if (!orderId) {
        setLoading(false);
        setError('Commande introuvable.');
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError('');
      setNotReady(false);

      try {
        const result = await sellerApi.pickupProof(orderId);
        setProof(result ?? null);
      } catch (e: any) {
        setProof(null);

        if (e?.status === 409) {
          setNotReady(true);
        } else {
          setError(e?.message ?? 'Impossible de récupérer le code de remise.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <Skeleton width={150} height={14} radius={radius.pill} />
          <Skeleton width={290} height={34} radius={radius.md} />
          <Skeleton width="92%" height={44} radius={radius.md} />
          <Skeleton width={270} height={270} radius={radius.lg} />
          <Skeleton width={150} height={34} radius={radius.md} />
          <Skeleton width="100%" height={64} radius={radius.lg} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>REMISE DU COLIS</Text>
          <Text style={styles.title}>Code de remise</Text>
          <Text style={styles.subtitle}>
            Utilisez ce QR ou le code à 6 chiffres lorsque le transporteur
            récupère le colis.
          </Text>
        </View>

        {proof ? (
          <>
            <Card style={styles.stateCard}>
              <View style={styles.stateIndicator} />
              <View style={styles.stateCopy}>
                <Text style={styles.stateTitle}>Code disponible</Text>
                <Text style={styles.stateText}>
                  Présentez le code au moment de la remise du colis.
                </Text>
              </View>
            </Card>

            <ProofDisplay
              title="Code de remise au transporteur"
              helperText="Le QR peut être scanné. À défaut, communiquez le code à 6 chiffres."
              pin={proof.pin}
              qrPayload={proof.qr_payload}
              expiresAt={proof.expires_at}
            />

            <Card style={styles.reminderCard}>
              <Text style={styles.reminderTitle}>Avant la remise</Text>
              <Text style={styles.reminderText}>
                Vérifiez que le transporteur vient bien récupérer la commande
                correspondante avant de partager le code.
              </Text>
            </Card>

            <Button
              title="Actualiser le code"
              variant="secondary"
              onPress={() => load(true)}
              fullWidth
              disabled={refreshing}
              loading={refreshing}
            />
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Card style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>⌁</Text>
              </View>

              <Text style={styles.emptyTitle}>
                {notReady
                  ? 'Le code n’est pas encore disponible'
                  : 'Code indisponible'}
              </Text>

              <Text style={styles.emptyText}>
                {notReady
                  ? 'Le code de remise sera disponible dès qu’un transporteur aura accepté la mission.'
                  : error || 'Nous n’avons pas pu récupérer le code de remise pour cette commande.'}
              </Text>

              <Button
                title="Actualiser"
                variant="secondary"
                onPress={() => load(true)}
                fullWidth
                disabled={refreshing}
                loading={refreshing}
              />
            </Card>

            <Text style={styles.orderHint}>
              Commande : {orderId}
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[4],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[4],
  },
  header: {
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
  },
  subtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    maxWidth: 370,
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.25)',
    backgroundColor: 'rgba(201, 151, 28, 0.06)',
  },
  stateIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: colors.gold,
  },
  stateCopy: {
    flex: 1,
    gap: spacing[1],
  },
  stateTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  stateText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  reminderCard: {
    padding: spacing[4],
    gap: spacing[1],
  },
  reminderTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  reminderText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[8],
    gap: spacing[3],
  },
  emptyCard: {
    width: '100%',
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 28,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  orderHint: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
