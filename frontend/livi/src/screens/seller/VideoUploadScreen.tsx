import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { liveApi } from '../../features/live/liveApi';
import { Button, Card, Screen } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function VideoUploadScreen({ navigation }: any) {
  const [uri, setUri] = useState('');
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  const canUpload = !!uri && title.trim().length > 0 && !busy;

  const helper = useMemo(() => {
    if (!uri) {
      return 'Sélectionnez un fichier vidéo depuis votre appareil.';
    }
    return 'Votre vidéo est prête. Complétez le titre avant publication.';
  }, [uri]);

  const pick = useCallback(async () => {
    setPicking(true);
    setError('');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file?.uri) {
        setError('Le fichier vidéo sélectionné est introuvable.');
        return;
      }

      setUri(file.uri);
      setFileName(file.name ?? 'Vidéo sélectionnée');
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de sélectionner la vidéo.');
    } finally {
      setPicking(false);
    }
  }, []);

  const upload = useCallback(async () => {
    const cleanTitle = title.trim();

    if (!uri || !cleanTitle) {
      setError('Sélectionnez une vidéo et renseignez son titre.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await liveApi.uploadVideo(uri, {
        title: cleanTitle,
        description: description.trim(),
      });

      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'La publication de la vidéo a échoué.');
    } finally {
      setBusy(false);
    }
  }, [description, navigation, title, uri]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CONTENU VIDÉO</Text>
            <Text style={styles.title}>Publier une vidéo</Text>
            <Text style={styles.subtitle}>
              Préparez votre contenu puis publiez-le avec les métadonnées
              réellement prises en charge par le service vidéo.
            </Text>
          </View>

          {error ? (
            <Card style={styles.errorCard}>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Fichier vidéo</Text>

            <Pressable
              onPress={pick}
              disabled={picking || busy}
              style={({ pressed }) => [
                styles.dropZone,
                uri ? styles.dropZoneSelected : null,
                pressed && !picking && !busy ? styles.dropZonePressed : null,
              ]}
            >
              <View style={styles.videoIcon}>
                <Text style={styles.videoIconText}>{uri ? '✓' : '▶'}</Text>
              </View>

              <Text style={styles.dropTitle}>
                {picking
                  ? 'Sélection en cours…'
                  : uri
                    ? 'Vidéo sélectionnée'
                    : 'Choisir une vidéo'}
              </Text>

              <Text style={styles.dropText} numberOfLines={2}>
                {fileName || helper}
              </Text>

              <View style={styles.dropHint}>
                <Text style={styles.dropHintText}>
                  Appuyez pour choisir un fichier
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.formSection}>
            <View style={styles.field}>
              <Text style={styles.label}>Titre</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Titre de la vidéo"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="sentences"
                maxLength={120}
                editable={!busy}
              />
              <Text style={styles.counter}>{title.length}/120</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.optional}>Facultatif</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez brièvement votre contenu…"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
                maxLength={500}
                editable={!busy}
              />
              <Text style={styles.counter}>{description.length}/500</Text>
            </View>
          </View>

          <Card style={styles.publishCard}>
            <View style={styles.publishCopy}>
              <Text style={styles.publishTitle}>Prêt à publier ?</Text>
              <Text style={styles.publishText}>
                Le titre est obligatoire. La description peut rester vide.
              </Text>
            </View>

            <Button
              title={busy ? 'Publication…' : 'Publier la vidéo'}
              onPress={upload}
              disabled={!canUpload}
              loading={busy}
              fullWidth
              size="lg"
            />
          </Card>

          <Text style={styles.footerNote}>
            La publication utilise directement le service vidéo vendeur de
            Livi.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[5],
  },
  header: {
    gap: spacing[2],
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
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255,94,94,0.25)',
    backgroundColor: 'rgba(255,94,94,0.07)',
  },
  errorDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  errorText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  section: {
    gap: spacing[2],
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  dropZone: {
    minHeight: 220,
    padding: spacing[6],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
    gap: spacing[2],
  },
  dropZoneSelected: {
    borderColor: 'rgba(201,151,28,0.35)',
    backgroundColor: 'rgba(201,151,28,0.055)',
  },
  dropZonePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  videoIcon: {
    width: 64,
    height: 64,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,151,28,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,151,28,0.22)',
  },
  videoIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 24,
  },
  dropTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  dropText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 310,
  },
  dropHint: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  dropHintText: {
    color: colors.gray3,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  formSection: {
    gap: spacing[4],
  },
  field: {
    gap: spacing[2],
  },
  label: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  optional: {
    position: 'absolute',
    right: 0,
    top: 1,
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
  textArea: {
    minHeight: 132,
    paddingTop: spacing[4],
  },
  counter: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 10,
    textAlign: 'right',
  },
  publishCard: {
    padding: spacing[5],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201,151,28,0.25)',
    backgroundColor: 'rgba(201,151,28,0.055)',
  },
  publishCopy: {
    gap: spacing[1],
  },
  publishTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  publishText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  footerNote: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
});
