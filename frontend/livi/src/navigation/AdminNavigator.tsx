import React from 'react';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SecurityScreen } from '../screens/profile/SecurityScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminResourceScreen } from '../screens/admin/AdminResourceScreen';
import { adminApi } from '../features/admin/adminApi';
import { DisputesScreen } from '../screens/disputes/DisputesScreen';
import { DisputeDetailsScreen } from '../screens/disputes/DisputeDetailsScreen';
import { PlatformAnalyticsScreen } from '../screens/admin/PlatformAnalyticsScreen';
import { SupportCenterScreen } from '../screens/admin/SupportCenterScreen';
import { AdminKycReviewScreen } from '../screens/admin/AdminKycReviewScreen';
import { AdminIntegrityScreen } from '../screens/admin/AdminIntegrityScreen';
import { AdminFinanceScreen } from '../screens/admin/AdminFinanceScreen';
import { AdminReconciliationScreen } from '../screens/admin/AdminReconciliationScreen';
import { AdminPayoutsQueueScreen } from '../screens/admin/AdminPayoutsQueueScreen';

const Stack = createNativeStackNavigator();

export function AdminNavigator() {
  return (
    <Stack.Navigator>
      {/* V-AUDIT: AdminDashboard moved first — it's the admin role's actual
          hub (18 links to every other admin screen, see
          AdminDashboardScreen.tsx) and React Navigation defaults to the
          first child as the initial route, same as SellerNavigator
          (SellerDashboard first) and TransporterNavigator (Dashboard
          first). This screen, and everything it links to, was previously
          unreachable: Profile listed first here, and
          ProfileScreen's ROLE_LINKS.admin was an empty array — an admin
          logging in landed on Profile with only "Sécurité"/"Notifications"
          as options, no path into the admin panel at all. */}
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Administration' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Sécurité' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="AdminAnalytics" component={PlatformAnalyticsScreen} options={{ title: 'Analytics' }} />
      <Stack.Screen name="AdminSupport" component={SupportCenterScreen} options={{ title: 'Support Center' }} />
      <Stack.Screen name="AdminUsers">{() => <AdminResourceScreen title="Utilisateurs" loader={adminApi.listUsers} />}</Stack.Screen>
      <Stack.Screen name="AdminSellers">{() => <AdminResourceScreen title="Vendeurs" loader={adminApi.listSellers} />}</Stack.Screen>
      <Stack.Screen name="AdminTransporters">{() => <AdminResourceScreen title="Transporteurs" loader={adminApi.listTransporters} />}</Stack.Screen>
      <Stack.Screen name="AdminOrders">{() => <AdminResourceScreen title="Commandes" loader={adminApi.listOrders} />}</Stack.Screen>
      <Stack.Screen name="AdminPayments">{() => <AdminResourceScreen title="Paiements" loader={adminApi.listPayments} />}</Stack.Screen>
      <Stack.Screen name="AdminEscrow">{() => <AdminResourceScreen title="Escrow" loader={adminApi.listEscrow} />}</Stack.Screen>
      <Stack.Screen name="AdminWithdrawals">{() => <AdminResourceScreen title="Retraits (historique)" loader={adminApi.listWithdrawals} />}</Stack.Screen>
      <Stack.Screen name="AdminDisputes" component={DisputesScreen} options={{ title: 'Litiges' }} />
      {/* V-AUDIT: was "AdminDisputeDetails" — DisputesScreen.tsx (this same
          shared component) calls navigation.navigate('DisputeDetails', ...),
          a hardcoded literal. BuyerNavigator and SellerNavigator both
          register this destination as "DisputeDetails"; this was the only
          one of the three using a different name, so tapping a dispute row
          here had no matching route to navigate to. */}
      <Stack.Screen name="DisputeDetails" component={DisputeDetailsScreen} options={{ title: 'Litige' }} />
      <Stack.Screen name="AdminVerifications" component={AdminKycReviewScreen} options={{ title: 'Vérifications KYC' }} />
      <Stack.Screen name="AdminProducts">{() => <AdminResourceScreen title="Produits" loader={adminApi.listProducts} />}</Stack.Screen>
      <Stack.Screen name="AdminMissions">{() => <AdminResourceScreen title="Missions" loader={adminApi.listMissions} />}</Stack.Screen>
      <Stack.Screen name="AdminLogs">{() => <AdminResourceScreen title="Logs" loader={adminApi.listLogs} />}</Stack.Screen>
      <Stack.Screen name="AdminIntegrity" component={AdminIntegrityScreen} options={{ title: 'Intégrité' }} />
      <Stack.Screen name="AdminFinance" component={AdminFinanceScreen} options={{ title: 'Finance' }} />
      <Stack.Screen name="AdminReconciliation" component={AdminReconciliationScreen} options={{ title: 'Réconciliation' }} />
      <Stack.Screen name="AdminPayoutsQueue" component={AdminPayoutsQueueScreen} options={{ title: 'File de retraits' }} />
    </Stack.Navigator>
  );
}
