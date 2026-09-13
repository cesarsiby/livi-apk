import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../design/theme';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SecurityScreen } from '../screens/profile/SecurityScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SellerProductsScreen } from '../screens/seller/SellerProductsScreen';
import { SellerOrdersScreen } from '../screens/seller/SellerOrdersScreen';
import { SellerOrderDetailsScreen } from '../screens/seller/SellerOrderDetailsScreen';
import { SellerPickupProofScreen } from '../screens/seller/SellerPickupProofScreen';
import { SellerProductEditorScreen } from '../screens/seller/SellerProductEditorScreen';
import { SellerDashboardScreen } from '../screens/seller/SellerDashboardScreen';
import { InventoryScreen } from '../screens/seller/InventoryScreen';
import { AnalyticsScreen } from '../screens/seller/AnalyticsScreen';
import { PayoutsScreen } from '../screens/seller/PayoutsScreen';
import { SellerMessagesScreen } from '../screens/seller/SellerMessagesScreen';
import { SellerOnboardingScreen } from '../screens/seller/SellerOnboardingScreen';
import { SellerKYCScreen } from '../screens/seller/SellerKYCScreen';
import { WalletScreen } from '../screens/wallet/WalletScreen';
import { TransactionsScreen } from '../screens/wallet/TransactionsScreen';
import { TransactionDetailsScreen } from '../screens/wallet/TransactionDetailsScreen';
import { WithdrawScreen } from '../screens/wallet/WithdrawScreen';
import { WithdrawalDetailsScreen } from '../screens/wallet/WithdrawalDetailsScreen';
import { DisputesScreen } from '../screens/disputes/DisputesScreen';
import { DisputeDetailsScreen } from '../screens/disputes/DisputeDetailsScreen';
import { VideoManagerScreen } from '../screens/seller/VideoManagerScreen';
import { VideoUploadScreen } from '../screens/seller/VideoUploadScreen';
import { VideoAnalyticsScreen } from '../screens/seller/VideoAnalyticsScreen';
import { CreatorToolsScreen } from '../screens/seller/CreatorToolsScreen';
import { LiveDashboardScreen } from '../screens/seller/LiveDashboardScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

// LIVI 2.0 (RAPPORT_UXUI_SESSION21) : avant cette refonte, le vendeur
// n'avait AUCUNE navigation persistante (stack pur) alors que l'acheteur
// avait déjà une bottom tab bar — incohérence relevée au constat C3 de
// l'audit. Ces 5 onglets reprennent la même logique que BuyerNavigator
// (accueil / activité principale / catalogue-équivalent / wallet / profil)
// pour que les deux rôles se comportent pareil à navigation égale.
const TAB_ICONS: Record<string, string> = {
  SellerDashboard: '🏠',
  Orders: '📦',
  Products: '🛍️',
  Wallet: '💳',
  Profile: '👤',
};

function TabIcon({ route, color }: { route: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{TAB_ICONS[route] ?? '•'}</Text>;
}

function SellerTabs() {
  return (
    <Tabs.Navigator
      initialRouteName="SellerDashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.dark2, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <TabIcon route={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="Orders" component={SellerOrdersScreen} options={{ title: 'Commandes' }} />
      <Tabs.Screen name="Products" component={SellerProductsScreen} options={{ title: 'Produits' }} />
      {/* Même nom de route que les Stack.Screen ci-dessous, volontairement —
          voir le commentaire équivalent dans BuyerNavigator.tsx : la
          résolution React Navigation choisit le navigateur le plus proche
          de l'appelant, donc navigate('Wallet') garde la tab bar depuis un
          onglet et pousse un écran plein depuis un flow (ex. Payouts). */}
      <Tabs.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tabs.Navigator>
  );
}

export function SellerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SellerTabs" component={SellerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="VideoManager" component={VideoManagerScreen} options={{ title: 'Mes vidéos' }} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen} options={{ title: 'Uploader une vidéo' }} />
      <Stack.Screen name="VideoAnalytics" component={VideoAnalyticsScreen} options={{ title: 'Analytics vidéo' }} />
      <Stack.Screen name="CreatorTools" component={CreatorToolsScreen} options={{ title: 'Creator Tools' }} />
      <Stack.Screen name="LiveDashboard" component={LiveDashboardScreen} options={{ title: 'Live Dashboard' }} />
      <Stack.Screen name="SellerProductEditor" component={SellerProductEditorScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventaire' }} />
      <Stack.Screen name="SellerOrderDetails" component={SellerOrderDetailsScreen} options={{ title: 'Commande' }} />
      <Stack.Screen name="SellerPickupProof" component={SellerPickupProofScreen} options={{ title: 'Code de remise' }} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Statistiques' }} />
      <Stack.Screen name="Payouts" component={PayoutsScreen} options={{ title: 'Versements' }} />
      <Stack.Screen name="Messages" component={SellerMessagesScreen} options={{ title: 'Messages clients' }} />
      <Stack.Screen name="Onboarding" component={SellerOnboardingScreen} options={{ title: 'Boutique' }} />
      <Stack.Screen name="KYC" component={SellerKYCScreen} options={{ title: 'Vérification KYC' }} />
      {/* Doublons volontaires de noms de route avec les onglets ci-dessus — voir SellerTabs. */}
      <Stack.Screen name="Orders" component={SellerOrdersScreen} options={{ title: 'Commandes' }} />
      <Stack.Screen name="Products" component={SellerProductsScreen} options={{ title: 'Mes produits' }} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawalDetails" component={WithdrawalDetailsScreen} />
      <Stack.Screen name="Disputes" component={DisputesScreen} />
      <Stack.Screen name="DisputeDetails" component={DisputeDetailsScreen} options={{ title: 'Litige' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Sécurité' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}
