import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../design/theme';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SecurityScreen } from '../screens/profile/SecurityScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { CatalogueScreen } from '../screens/buyer/CatalogueScreen';
import { ProductScreen } from '../screens/buyer/ProductScreen';
import { CartScreen } from '../screens/buyer/CartScreen';
import { CheckoutScreen } from '../screens/buyer/CheckoutScreen';
import { OrdersScreen } from '../screens/buyer/OrdersScreen';
import { OrderDetailsScreen } from '../screens/buyer/OrderDetailsScreen';
import { HomeScreen } from '../screens/buyer/HomeScreen';
import { AddressesScreen } from '../screens/buyer/AddressesScreen';
import { WishlistScreen } from '../screens/buyer/WishlistScreen';
import { RefundsScreen } from '../screens/buyer/RefundsScreen';
import { PaymentMethodsScreen } from '../screens/buyer/PaymentMethodsScreen';
import { EscrowCenterScreen } from '../screens/buyer/EscrowCenterScreen';
import { BuyerQRValidationScreen } from '../screens/buyer/BuyerQRValidationScreen';
import { DeliveryTrackingScreen } from '../screens/buyer/DeliveryTrackingScreen';
import { BuyerMessagesScreen } from '../screens/buyer/BuyerMessagesScreen';
import { WalletScreen } from '../screens/wallet/WalletScreen';
import { TransactionsScreen } from '../screens/wallet/TransactionsScreen';
import { TransactionDetailsScreen } from '../screens/wallet/TransactionDetailsScreen';
import { WithdrawScreen } from '../screens/wallet/WithdrawScreen';
import { WithdrawalDetailsScreen } from '../screens/wallet/WithdrawalDetailsScreen';
import { DisputesScreen } from '../screens/disputes/DisputesScreen';
import { CreateDisputeScreen } from '../screens/disputes/CreateDisputeScreen';
import { DisputeDetailsScreen } from '../screens/disputes/DisputeDetailsScreen';
import { FeedScreen } from '../screens/social/FeedScreen';
import { LiveShopsScreen } from '../screens/live/LiveShopsScreen';
import { LiveShopScreen } from '../screens/live/LiveShopScreen';
import { DepositScreen } from '../screens/escrow/DepositScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

// LIVI 2.0 (RAPPORT_UXUI_SESSION21) : "Feed" (contenu social pur, sans
// recherche ni accès rapide au wallet/commandes — constat C2 de l'audit)
// n'est plus l'accueil. "Home" fusionne l'utilité de l'ancien
// BuyerDashboard (inatteignable — constat C1) avec un aperçu du feed
// vidéo. "Wallet" devient un onglet à part entière plutôt qu'un
// raccourci enterré dans Profil (constat C4) ; "Messages" reste
// disponible en un tap depuis Profil/Accueil plutôt qu'un onglet dédié,
// pour garder 5 onglets alignés sur les priorités réelles de l'acheteur.
const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Catalogue: '🛍️',
  Orders: '📦',
  Wallet: '💳',
  Profile: '👤',
};

function TabIcon({ route, color }: { route: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{TAB_ICONS[route] ?? '•'}</Text>;
}

function BuyerTabs() {
  return (
    <Tabs.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.dark2,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <TabIcon route={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tabs.Screen name="Catalogue" component={CatalogueScreen} options={{ title: 'Catalogue' }} />
      <Tabs.Screen name="Orders" component={OrdersScreen} options={{ title: 'Commandes' }} />
      {/* Même nom de route que le Stack.Screen "Wallet" ci-dessous, par
          choix : depuis un onglet, navigate('Wallet') résout vers CET
          onglet (garde la tab bar) ; depuis un écran de pile (Checkout,
          Product…), le même appel résout vers l'écran de pile (plein
          écran). Les deux résolutions sont voulues, aucune régression sur
          les appels navigate('Wallet') déjà présents dans Profile,
          SellerDashboard et TransporterDashboard. */}
      <Tabs.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tabs.Navigator>
  );
}

export function BuyerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BuyerTabs" component={BuyerTabs} options={{ headerShown: false }} />
      {/* Feed vidéo complet (vertical, façon découverte) — accessible depuis
          Home ("Découvrir en vidéo → Voir tout"), plus l'accueil lui-même. */}
      <Stack.Screen name="Feed" component={FeedScreen} options={{ title: 'Vidéos LIVI', headerShown: false }} />
      <Stack.Screen name="Messages" component={BuyerMessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Panier' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Paiement' }} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Commande' }} />
      <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} options={{ title: 'Suivi livraison' }} />
      <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'Mes adresses' }} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: 'Wishlist' }} />
      <Stack.Screen name="Refunds" component={RefundsScreen} options={{ title: 'Remboursements' }} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: 'Moyens de paiement' }} />
      <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Stack.Screen name="Escrow" component={EscrowCenterScreen} options={{ title: 'Escrow' }} />
      <Stack.Screen name="Deposit" component={DepositScreen} options={{ title: 'Dépôt Mobile Money' }} />
      <Stack.Screen name="QRValidation" component={BuyerQRValidationScreen} options={{ title: 'QR / PIN' }} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} options={{ title: 'Transaction' }} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Retrait' }} />
      <Stack.Screen name="WithdrawalDetails" component={WithdrawalDetailsScreen} options={{ title: 'Retrait' }} />
      <Stack.Screen name="Disputes" component={DisputesScreen} options={{ title: 'Litiges' }} />
      <Stack.Screen name="CreateDispute" component={CreateDisputeScreen} options={{ title: 'Ouvrir un litige' }} />
      <Stack.Screen name="DisputeDetails" component={DisputeDetailsScreen} options={{ title: 'Litige' }} />
      <Stack.Screen name="LiveShops" component={LiveShopsScreen} options={{ title: 'Live Shopping' }} />
      <Stack.Screen name="LiveShop" component={LiveShopScreen} options={{ title: 'Live' }} />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Sécurité' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}
