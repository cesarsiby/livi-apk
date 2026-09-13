import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Bloc de chargement (shimmer léger). But : éviter les sauts de mise en
 * page entre "chargement" et "contenu" — un skeleton respecte à peu près
 * la forme finale, contrairement à un simple spinner centré qui fait
 * disparaître toute la mise en page pendant le fetch.
 */
export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.dark4, opacity }, style]}
    />
  );
}
