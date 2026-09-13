import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { VerifyOtpScreen } from '../screens/auth/VerifyOtpScreen';
import { ResetNewPasswordScreen } from '../screens/auth/ResetNewPasswordScreen';
import { BuyerNavigator } from './BuyerNavigator';
import { SellerNavigator } from './SellerNavigator';
import { TransporterNavigator } from './TransporterNavigator';
import { AdminNavigator } from './AdminNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Créer un compte' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Mot de passe oublié' }} />
        <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} options={{ title: 'Vérification téléphone' }} />
        <Stack.Screen name="ResetNewPassword" component={ResetNewPasswordScreen} options={{ title: 'Nouveau mot de passe' }} />
      </Stack.Navigator>
    );
  }

  switch (session.user.role) {
    case 'client': return <BuyerNavigator />;
    case 'vendor': return <SellerNavigator />;
    case 'transporter': return <TransporterNavigator />;
    case 'admin': return <AdminNavigator />;
  }
}
