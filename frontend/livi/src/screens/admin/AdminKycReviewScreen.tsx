import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { ENV } from '../../config/env';
import { Card, Button, Badge } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

type KycDoc = { id: string; user_id: string; document_type: string; status: string; created_at: string; user_name?: string; user_phone?: string };

// V54 (RAPPORT section 17 — "ADMIN KYC — PRIORITÉ CRITIQUE"): this screen let
// an admin approve or reject a KYC document without ever seeing it — no
// preview existed anywhere between the list and the Approuver/Rejeter
// buttons. The backend's secure access-token + download flow
// (POST /kyc/admin/:id/access-token, GET /kyc/documents/:id/download,
// src/routes/kyc.js) already existed, short-lived and fully audited; nothing
// called it. Fetches the file as a blob with both the normal session Bearer
// token AND the short-lived document token (the download route requires
// both), then renders it as an image. Most KYC submissions from this app are
// camera/gallery photos (expo-document-picker allows image/* and
// application/pdf — see TransporterKYCScreen/SellerKYCScreen), so this
// covers the common case; PDFs fail to render as an image and fall back to a
// clear "no preview" message rather than a blank/broken image.
export function AdminKycReviewScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<KycDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string | 'unavailable'>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try { refresh ? setRefreshing(true) : setLoading(true); setError(null); setItems(await adminApi.kycPending()); }
    catch (e: any) { setError(e?.message ?? 'Impossible de charger les documents en attente.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadPreview = useCallback(async (docId: string) => {
    if (previews[docId] || !session?.accessToken) return;
    setPreviewLoading(docId);
    try {
      const { token } = await adminApi.kycDocumentAccessToken(docId);
      const response = await fetch(`${ENV.API_BASE_URL}/kyc/documents/${encodeURIComponent(docId)}/download?token=${encodeURIComponent(token)}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) throw new Error('download_failed');
      const blob = await response.blob();
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(blob);
      });
      setPreviews((current) => ({ ...current, [docId]: dataUri }));
    } catch {
      setPreviews((current) => ({ ...current, [docId]: 'unavailable' }));
    } finally {
      setPreviewLoading(null);
    }
  }, [previews, session?.accessToken]);

  async function review(id: string, status: 'approved' | 'rejected') {
    try {
      setBusyId(id);
      await adminApi.kycReview(id, status, status === 'rejected' ? (reasons[id] || '').trim() : undefined);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (e: any) { setError(e?.message ?? 'Action impossible.'); }
    finally { setBusyId(null); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListHeaderComponent={<>
        <Text style={styles.title}>Vérifications KYC en attente</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </>}
      ListEmptyComponent={<Text style={styles.muted}>Aucun document en attente.</Text>}
      renderItem={({ item }) => {
        const preview = previews[item.id];
        return (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.user_name ?? item.user_phone ?? item.user_id}</Text>
              <Badge label={item.document_type} variant="blue" />
            </View>
            <Text style={styles.muted}>Soumis le {new Date(item.created_at).toLocaleString()}</Text>

            {!preview && (
              <Button
                title={previewLoading === item.id ? 'Chargement…' : 'Voir le document'}
                onPress={() => loadPreview(item.id)}
                disabled={previewLoading === item.id}
                loading={previewLoading === item.id}
                variant="outline"
                size="sm"
              />
            )}
            {preview === 'unavailable' && (
              <Text style={styles.muted}>Aperçu indisponible pour ce fichier (probablement un PDF). Le document reste consultable via son export sécurisé.</Text>
            )}
            {!!preview && preview !== 'unavailable' && (
              <Image
                source={{ uri: preview }}
                style={styles.preview}
                resizeMode="contain"
                onError={() => setPreviews((current) => ({ ...current, [item.id]: 'unavailable' }))}
              />
            )}

            <TextInput
              value={reasons[item.id] ?? ''}
              onChangeText={(text) => setReasons((current) => ({ ...current, [item.id]: text }))}
              placeholder="Motif de rejet (si rejeté)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <View style={styles.actions}>
              <Button title={busyId === item.id ? '…' : 'Approuver'} variant="green" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => review(item.id, 'approved')} />
              <Button title={busyId === item.id ? '…' : 'Rejeter'} variant="red" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => review(item.id, 'rejected')} />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[4], gap: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, marginBottom: spacing[3], color: colors.textPrimary },
  card: { padding: spacing[4], marginBottom: spacing[3], gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: fontSize.md },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
  error: { color: colors.red, fontFamily: fonts.body, marginBottom: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing[2], color: colors.textPrimary, fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: spacing[2] },
  preview: { width: '100%', height: 220, borderRadius: 8, backgroundColor: colors.dark4 },
});
