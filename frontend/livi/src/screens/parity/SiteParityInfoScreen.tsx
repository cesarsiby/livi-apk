import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, Screen } from '../../design/components';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type Action = {
  label: string;
  onPress: () => void;
};

type Props = {
  title: string;
  eyebrow?: string;
  description: string;
  bullets?: string[];
  actions?: Action[];
};

export function SiteParityInfoScreen({
  title,
  eyebrow,
  description,
  bullets = [],
  actions = [],
}: Props) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: entrance,
            transform: [{ translateY }],
          }}
        >
          <View style={styles.header}>
            {eyebrow ? (
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowMark} />
                <Text style={styles.eyebrow}>{eyebrow}</Text>
              </View>
            ) : null}

            <Text style={styles.title}>{title}</Text>

            <Text style={styles.description}>{description}</Text>
          </View>

          {bullets.length > 0 ? (
            <Card style={styles.card} padded>
              <Text style={styles.cardEyebrow}>À RETENIR</Text>

              <View style={styles.bulletList}>
                {bullets.map((item, index) => (
                  <View
                    key={`${index}-${item}`}
                    style={[
                      styles.bulletRow,
                      index < bullets.length - 1 && styles.bulletRowSpaced,
                    ]}
                  >
                    <View style={styles.bulletIcon}>
                      <Text style={styles.bulletIconText}>✓</Text>
                    </View>

                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((action, index) => (
                <Button
                  key={`${index}-${action.label}`}
                  title={action.label}
                  onPress={action.onPress}
                  fullWidth
                  size="lg"
                  variant={index === 0 ? 'primary' : 'outline'}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerMark}>
              <Text style={styles.footerMarkText}>L</Text>
            </View>
            <Text style={styles.footerText}>
              Informations fournies par Livi
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },
  header: {
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  eyebrowMark: {
    width: 18,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    lineHeight: 23,
  },
  card: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.dark3,
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.1,
    marginBottom: spacing[4],
  },
  bulletList: {
    gap: spacing[2],
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  bulletRowSpaced: {
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bulletIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletIconText: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
  },
  bulletText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    paddingTop: 3,
  },
  actions: {
    marginTop: spacing[5],
    gap: spacing[3],
  },
  footer: {
    marginTop: spacing[7],
    alignItems: 'center',
    gap: spacing[2],
  },
  footerMark: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerMarkText: {
    color: colors.gold,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
  },
  footerText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 9,
  },
});
