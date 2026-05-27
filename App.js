import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import auth                        from '@react-native-firebase/auth';
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
import TabBar                      from './src/components/TabBar';

const ADMIN_PHONE = '+573239420671';

export default function App() {
  const [screen,       setScreen]       = useState('Splash');
  const [screenParams, setScreenParams] = useState({});
  const [activeTab,    setActiveTab]    = useState('Home');
  const [isAdmin,      setIsAdmin]      = useState(false);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setIsAdmin(user?.phoneNumber === ADMIN_PHONE);
    });
    return unsubscribe;
  }, []);

  const navigate = (screenName, params) => {
    setScreenParams(params || {});
    setScreen(screenName);
  };

  if (screen === 'Splash')            return <SplashScreen navigate={navigate} />;
  if (screen === 'Login')             return <LoginScreen navigate={navigate} />;
  if (screen === 'OTP')               return <OTPScreen navigate={navigate} params={screenParams} />;
  if (screen === 'RegistroConductor') return <RegistroConductorScreen navigate={navigate} params={screenParams} />;
  if (screen === 'PantallaPendiente') return <PantallaPendienteScreen />;

  if (screen === 'EnServicio') {
    return <EnServicioScreen params={screenParams} goHome={() => navigate('App')} />;
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
      {activeTab === 'Home'      && <HomeScreen navigate={navigate} />}
      {activeTab === 'Ganancias' && <GananciasScreen navigate={navigate} />}
      {activeTab === 'Actividad' && <ActividadScreen />}
      {activeTab === 'Cuenta'    && <CuentaScreen />}
      {activeTab === 'Admin'     && <AdminScreen navigate={navigate} />}
      <TabBar active={activeTab} onPress={setActiveTab} isAdmin={isAdmin} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
