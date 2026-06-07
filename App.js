import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import auth                        from '@react-native-firebase/auth';
import * as Notifications          from 'expo-notifications';
import * as Device                 from 'expo-device';
import { fcmApi }                  from './src/api/client';
import { getUserUuid }             from './src/utils/tokenStorage';
import SplashScreen                from './src/screens/SplashScreen';
import LoginScreen                 from './src/screens/LoginScreen';
import OTPScreen                   from './src/screens/OTPScreen';
import RegistroConductorScreen     from './src/screens/RegistroConductorScreen';
import PantallaPendienteScreen     from './src/screens/PantallaPendienteScreen';
import HomeScreen                  from './src/screens/HomeScreen';
import GananciasScreen             from './src/screens/GananciasScreen';
import ActividadScreen             from './src/screens/ActividadScreen';
import CuentaScreen                from './src/screens/CuentaScreen';
import EnServicioScreen            from './src/screens/EnServicioScreen';
import AdminScreen                 from './src/screens/AdminScreen';
import DocumentosAdminScreen       from './src/screens/DocumentosAdminScreen';
import CreditoWEWINScreen          from './src/screens/CreditoWEWINScreen';
import ChatScreen                  from './src/screens/ChatScreen';
import TabBar                      from './src/components/TabBar';

const ADMIN_PHONE = '+573239420671';

/* ── Notificaciones: handler de primer plano ─────── */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ── Registro FCM ────────────────────────────────── */

async function registrarFCMToken() {
  try {
    if (!Device.isDevice) return;
    const backendUuid = await getUserUuid();
    if (!backendUuid) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('solicitudes', {
        name:              'Solicitudes de viaje',
        importance:        Notifications.AndroidImportance.MAX,
        vibrationPattern:  [0, 250, 250, 250],
        sound:             true,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    await fcmApi.registrar(backendUuid, token);
  } catch {}
}

export default function App() {
  const [screen,            setScreen]           = useState('Splash');
  const [screenParams,      setScreenParams]      = useState({});
  const [activeTab,         setActiveTab]         = useState('Home');
  const [isAdmin,           setIsAdmin]           = useState(false);
  const [pendingServiceId,  setPendingServiceId]  = useState(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setIsAdmin(user?.phoneNumber === ADMIN_PHONE);
      if (user) registrarFCMToken();
    });
    return unsubscribe;
  }, []);

  // Notificación recibida en primer plano → disparar modal
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const serviceId = notification.request.content.data?.service_id;
      if (serviceId) setPendingServiceId(serviceId);
    });
    return () => sub.remove();
  }, []);

  // Toque en notificación (background/cerrada) → ir a Home y mostrar modal
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const serviceId = response.notification.request.content.data?.service_id;
      setScreen('App');
      setActiveTab('Home');
      if (serviceId) setPendingServiceId(serviceId);
    });
    return () => sub.remove();
  }, []);

  const navigate = (screenName, params) => {
    setScreenParams(params || {});
    setScreen(screenName);
    if (screenName === 'App') registrarFCMToken();
  };

  if (screen === 'Splash')            return <SplashScreen navigate={navigate} />;
  if (screen === 'Login')             return <LoginScreen navigate={navigate} />;
  if (screen === 'OTP')               return <OTPScreen navigate={navigate} params={screenParams} />;
  if (screen === 'RegistroConductor') return <RegistroConductorScreen navigate={navigate} params={screenParams} />;
  if (screen === 'PantallaPendiente') return <PantallaPendienteScreen navigate={navigate} />;

  if (screen === 'EnServicio') {
    return <EnServicioScreen params={screenParams} goHome={() => navigate('App')} />;
  }

  if (screen === 'Chat') {
    return <ChatScreen serviceId={screenParams.serviceId} onClose={() => navigate('App')} />;
  }

  if (screen === 'DocumentosAdmin') {
    return (
      <DocumentosAdminScreen
        params={screenParams}
        onBack={() => navigate('App')}
      />
    );
  }

  if (screen === 'CreditoWEWIN') {
    return <CreditoWEWINScreen onBack={() => navigate('App')} />;
  }

  return (
    <View style={s.root}>
      {activeTab === 'Home'      && <HomeScreen navigate={navigate} pendingServiceId={pendingServiceId} onPendingServiceHandled={() => setPendingServiceId(null)} />}
      {activeTab === 'Ganancias' && <GananciasScreen navigate={navigate} />}
      {activeTab === 'Actividad' && <ActividadScreen />}
      {activeTab === 'Cuenta'    && <CuentaScreen navigate={navigate} />}
      {activeTab === 'Admin'     && <AdminScreen navigate={navigate} />}
      <TabBar active={activeTab} onPress={setActiveTab} isAdmin={isAdmin} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
