import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';

type Props = {
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  editable?: boolean;
  /** Si fourni, la barre devient un bouton (pas de saisie sur place) qui navigue ailleurs. */
  onPress?: () => void;
};

export function SearchBar({ value, onChangeText, placeholder = 'Rechercher sur LIVI', onSubmit, editable = true, onPress }: Props) {
  const content = (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔍</Text>
      {onPress ? (
        <Text style={styles.fakeInput} numberOfLines={1}>{value || placeholder}</Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={editable}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
        />
      )}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing[4], height: 48, gap: spacing[2] },
  icon: { fontSize: fontSize.base },
  input: { flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: fontSize.base, height: '100%' },
  fakeInput: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.base },
});
