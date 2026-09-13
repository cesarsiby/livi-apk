import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../design/theme';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SecurityScreen } from '../screens/profile/SecurityScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { MissionsScreen } from '../screens/transporter/MissionsScreen';
import { MissionDetailsScreen } from '../screens/transporter/MissionDetailsScreen';
import { TransporterDashboardScreen } from '../screens/transporter/TransporterDashboardScreen';
import { DeliveryHistoryScreen } from '../screens/transporter/DeliveryHistoryScreen';
import { EarningsScreen } from '../screens/transporter/EarningsScreen';
import { LiveMapScreen } from '../screens/transporter/LiveMapScreen';
import { TrackingScreen } from '../screens/transporter/TrackingScreen';
import { QRValidationScreen } from '../screens/transporter/QRValidationScreen';
import { AvailabilityScreen } from '../screens/transporter/AvailabilityScreen';
import { TransporterKYCScreen } from '../screens/transporter/TransporterKYCScreen';
import { VehicleScreen } from '../screens/transporter/VehicleScreen';
import { WalletScreen } from '../screens/wallet/WalletScreen';
import { TransactionsScreen } from '../screens/wallet/TransactionsScreen';
import { TransactionDetailsScreen } from '../screens/wallet/TransactionDetailsScreen';
import { WithdrawScreen } from '../screens/wallet/WithdrawScreen';
import { WithdrawalDetailsScreen } from '../screens/wallet/WithdrawalDetailsScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

// LIVI 2.0 (RAPPORT_UXUI_SESSION21) : même correction de cohérence que pour
// le vendeur (constat C3) — le transporteur n'avait aucune navigation
// persistante. 4 onglets seulement (au lieu de 5) : le transporteur a moins
// de zones distinctes à valeur égale — Tracking/QRValidation/History/
// Earnings/Vehicle/KYC restent à un tap de Dashboard ou Missions plutôt que
// de diluer la tab bar.
const TAB_ICONS: Record<string, string> = {
  Dashboard: '🏠',
  Missions: '🧭',
  Wallet: '💳',
  Profile: '👤',
};

function TabIcon({ route, color }: { route: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{TAB_ICONS[route] ?? '•'}</Text>;
}

function TransporterTabs() {
  return (
    <Tabs.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.dark2, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <TabIcon route={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="Dashboard" component={TransporterDashboardScreen} options={{ title: 'Tableau de bord' }} />
      <Tabs.Screen name="Missions" component={MissionsScreen} options={{ title: 'Missions' }} />
      {/* Nom de route partagé avec le Stack.Screen "Wallet" ci-dessous, comme
          dans BuyerNavigator/SellerNavigator — résolution contextuelle
          voulue, pas un doublon accidentel. */}
      <Tabs.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tabs.Navigator>
  );
}

export function TransporterNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TransporterTabs" component={TransporterTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} options={{ title: 'Disponibilité' }} />
      <Stack.Screen name="MissionDetails" component={MissionDetailsScreen} options={{ title: 'Mission' }} />
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ title: 'Suivi livraison' }} />
      <Stack.Screen name="LiveMap" component={LiveMapScreen} options={{ title: 'Carte live' }} />
      <Stack.Screen name="History" component={DeliveryHistoryScreen} options={{ title: 'Historique' }} />
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Mes revenus' }} />
      <Stack.Screen name="QRValidation" component={QRValidationScreen} options={{ title: 'QR / PIN' }} />
      <Stack.Screen name="KYC" component={TransporterKYCScreen} options={{ title: 'Vérification KYC' }} />
      <Stack.Screen name="Vehicle" component={VehicleScreen} options={{ title: 'Mon véhicule' }} />
      {/* Doublons volontaires de noms de route avec les onglets ci-dessus. */}
      <Stack.Screen name="Missions" component={MissionsScreen} options={{ title: 'Missions' }} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawalDetails" component={WithdrawalDetailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Sécurité' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}
