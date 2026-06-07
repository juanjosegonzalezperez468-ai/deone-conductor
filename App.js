import React, { useState, useEffect } from 'react';
import auth                        from '@react-native-firebase/auth';
import * as Notifications          from 'expo-notifications';
import * as Device                 from 'expo-device';
import { Platform }                from 'react-native';
import { fcmApi }                  from './src/api/client';
import { getUserUuid }             from './src/utils/tokenStorage';
import SplashScreen                from './src/screens/SplashScreen';
import LoginScreen                 from './src/screens/LoginScreen';
import OTPScreen                   from './src/screens/OTPScreen';
import RegistroConductorScreen     from './src/screens/RegistroConductorScreen';
import PantallaPendienteScreen     from './src/screens/PantallaPendienteScreen';
import SolicitudesScreen           from './src/screens/SolicitudesScreen';
import GananciasScreen             from './src/screens/GananciasScreen';
import ActividadScreen             from './src/screens/ActividadScreen';
import CuentaScreen                from './src/screens/CuentaScreen';
import EnServicioScreen            from './src/screens/EnServicioScreen';
import AdminScreen                 from './src/screens/AdminScreen';
import DocumentosAdminScreen       from './src/screens/DocumentosAdminScreen';
import CreditoWEWINScreen          from './src/screens/CreditoWEWINScreen';
import ChatScreen                  from './src/screens/ChatScreen';

const ADMIN_PHONE = '+573239420671';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registrarFCMToken() {
  try {
    if (!Device.isDevice) return;
    const backendUuid = await getUserUuid();
    if (!backendUuid) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('solicitudes', {
        name:             'Solicitudes de viaje',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound:            true,
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
  const [screen,       setScreen]      = useState('Splash');
  const [screenParams, setScreenParams] = useState({});
  const [isAdmin,      setIsAdmin]     = useState(false);
  const [disponible,   setDisponible]  = useState(false);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setIsAdmin(user?.phoneNumber === ADMIN_PHONE);
      if (user) registrarFCMToken();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) setScreen('App');
    });
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setScreen('App');
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
    return <DocumentosAdminScreen params={screenParams} onBack={() => navigate('App')} />;
  }
  if (screen === 'CreditoWEWIN') {
    return <CreditoWEWINScreen onBack={() => navigate('App')} />;
  }
  if (screen === 'Ganancias') {
    return <GananciasScreen navigate={navigate} />;
  }
  if (screen === 'Actividad') {
    return <ActividadScreen navigate={navigate} />;
  }
  if (screen === 'Cuenta') {
    return <CuentaScreen navigate={navigate} />;
  }
  if (screen === 'Admin') {
    return <AdminScreen navigate={navigate} />;
  }

  return <SolicitudesScreen navigate={navigate} isAdmin={isAdmin} disponible={disponible} onDisponibleChange={setDisponible} />;
}
