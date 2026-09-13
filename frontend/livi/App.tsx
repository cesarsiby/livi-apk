import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, Theme, LinkingOptions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from './src/features/auth/AuthProvider';
import { CartProvider } from './src/features/cart/cartStore';
import { WalletProvider } from './src/features/wallet/walletStore';
import { NotificationsProvider } from './src/features/notifications/NotificationsProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/design/theme';

// Thème de navigation sombre, aligné sur le fond marine du design LIVI
// (évite le flash blanc par défaut de React Navigation entre les écrans).
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.dark,
    card: colors.dark2,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.gold,
  },
};

// V54 (RAPPORT — "lien unique partageable pour chaque produit"): app.json
// already declared scheme: 'livi', but nothing mapped an incoming URL to a
// screen — opening a livi:// link just launched the app to its default
// route. Only wired for the case that matters for sharing (an already-
// logged-in buyer opening a shared product link): RootNavigator swaps its
// whole tree by auth/role, so a link opened while logged out — or as a
// vendor/transporter/admin — lands on that role's normal start screen
// instead of the product, rather than silently failing. Worth testing on a
// real device/simulator; it can't be exercised in this sandbox.
//
// Only the `livi://` scheme is used — it's the one actually declared in
// app.json. A web fallback (so the link still works for someone without the
// app installed) would need a real domain to point it at, which isn't
// something to invent here.
const linking: LinkingOptions<any> = {
  prefixes: ['livi://'],
  config: {
    screens: {
      Product: 'product/:productId',
    },
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark }}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <WalletProvider>
            <NotificationsProvider>
              <NavigationContainer theme={navigationTheme} linking={linking}>
                <RootNavigator />
              </NavigationContainer>
            </NotificationsProvider>
          </WalletProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
