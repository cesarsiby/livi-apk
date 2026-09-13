import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

type Props = React.PropsWithChildren<{
  style?: ViewStyle;
  centered?: boolean;
}>;

/** Fond marine plein écran, cohérent avec body { background: var(--bg-primary) } du site. */
export function Screen({ children, style, centered = false }: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.flex, styles.background, centered && styles.centered, style]}>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { backgroundColor: colors.dark },
  centered: { justifyContent: 'center', padding: 24 },
});
