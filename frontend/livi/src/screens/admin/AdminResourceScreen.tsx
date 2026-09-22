import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { normalizeCollection } from '../../features/admin/adminApi';
import type { AdminRecord } from '../../features/admin/types';
import {
  Card,
  EmptyState,
  Skeleton,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

type Props = {
  title: string;
  loader: () => Promise<unknown>;
};

function humanizeKey(key: string): string {
  const normalized = key.replace(/_/g, ' ').trim();
  if (!normalized) return key;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatValue(value: unknown): string {
  if (value == null) return '—';

  if (typeof value === 'string') {
    const isoDate = /^\d{4}-\d{2}-\d{2}T/.test(value);

    if (isoDate) {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString('fr-FR');
    }

    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toLocaleString('fr-FR')
      : String(value);
  }

  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getSearchText(item: AdminRecord) {
  return Object.entries(item)
    .map(([key, value]) => `${key} ${formatValue(value)}`)
    .join(' ')
    .toLocaleLowerCase('fr-FR');
}

export function AdminResourceScreen({ title, loader }: Props) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const response = await loader();
        setItems(normalizeCollection(response as any));
      } catch (e: any) {
        setError(e?.message ?? `Impossible de charger ${title}.`);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loader, title],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase('fr-FR');

    if (!cleanQuery) return items;

    return items.filter((item) => getSearchText(item).includes(cleanQuery));
  }, [items, query]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={120} height={14} radius={radius.pill} />
        <Skeleton width={220} height={34} radius={radius.md} />
        <Skeleton width="100%" height={50} radius={radius.md} />
        <Skeleton width="100%" height={148} radius={radius.lg} />
        <Skeleton width="100%" height={148} radius={radius.lg} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item, index) => String(item?.id ?? index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          filteredItems.length === 0 ? styles.emptyContent : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>ADMINISTRATION</Text>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.headerMeta}>
              <View style={styles.countPill}>
                <Text style={styles.countValue}>{items.length}</Text>
                <Text style={styles.countLabel}>
                  {items.length > 1 ? 'éléments' : 'élément'}
                </Text>
              </View>

              {query.trim() ? (
                <Text style={styles.filterText}>
                  {filteredItems.length} affiché
                  {filteredItems.length > 1 ? 's' : ''}
                </Text>
              ) : null}
            </View>

            {items.length > 0 ? (
              <View style={styles.searchShell}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher dans les données…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {query ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={10}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <Card style={styles.errorCard}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon="⌕"
              title="Aucun résultat"
              description="Aucune donnée de cette ressource ne correspond à votre recherche."
              actionLabel="Effacer la recherche"
              onAction={() => setQuery('')}
            />
          ) : (
            <EmptyState
              icon="□"
              title="Aucune donnée"
              description="Le service administrateur n’a retourné aucun élément."
            />
          )
        }
        renderItem={({ item }) => {
          const fields = Object.entries(item)
            .filter(([key]) => key !== 'id')
            .slice(0, 6);

          return (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.idBlock}>
                  <Text style={styles.idLabel}>IDENTIFIANT</Text>
                  <Text style={styles.idValue} numberOfLines={1}>
                    {String(item.id ?? '—')}
                  </Text>
                </View>

                <View style={styles.cardChevron}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>

              {fields.length > 0 ? (
                <View style={styles.fields}>
                  {fields.map(([key, value]) => (
                    <View key={key} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel} numberOfLines={2}>
                        {humanizeKey(key)}
                      </Text>
                      <Text style={styles.fieldValue} numberOfLines={4}>
                        {formatValue(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noFields}>
                  Aucun autre champ retourné.
                </Text>
              )}

              {Object.keys(item).length > 7 ? (
                <Text style={styles.moreFields}>
                  Aperçu des 6 premiers champs après l’identifiant.
                </Text>
              ) : null}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    gap: spacing[3],
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
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  countPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(201, 151, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.2)',
  },
  countValue: {
    color: colors.gold2,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
  },
  countLabel: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  filterText: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  searchShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },
  searchIcon: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 24,
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clearText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: 19,
    lineHeight: 20,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.25)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: colors.red,
  },
  errorText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  card: {
    padding: spacing[4],
    gap: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  idBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  idLabel: {
    color: colors.gray3,
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  idValue: {
    color: colors.gold2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
  },
  cardChevron: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chevron: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 22,
  },
  fields: {
    gap: spacing[3],
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  fieldLabel: {
    width: '37%',
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  fieldValue: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    lineHeight: 18,
    textAlign: 'right',
  },
  moreFields: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
  },
  noFields: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
});
