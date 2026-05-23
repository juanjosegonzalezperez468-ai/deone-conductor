import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import SplashScreen            from './src/screens/SplashScreen';
import LoginScreen             from './src/screens/LoginScreen';
import OTPScreen               from './src/screens/OTPScreen';
import RegistroConductorScreen from './src/screens/RegistroConductorScreen';
import PantallaPendienteScreen from './src/screens/PantallaPendienteScreen';
import HomeScreen              from './src/screens/HomeScreen';
import GananciasScreen         from './src/screens/GananciasScreen';
import ActividadScreen         from './src/screens/ActividadScreen';
import CuentaScreen            from './src/screens/CuentaScreen';
import EnServicioScreen        from './src/screens/EnServicioScreen';
import TabBar                  from './src/components/TabBar';

export default function App() {
  const [screen,       setScreen]       = useState('Splash');
  const [screenParams, setScreenParams] = useState({});
  const [activeTab,    setActiveTab]    = useState('Home');

  const navigate = (screenName, params) => {
    setScreenParams(params || {});
    setScreen(screenName);
  };

  if (screen === 'Splash')           return <SplashScreen navigate={navigate} />;
  if (screen === 'Login')            return <LoginScreen navigate={navigate} />;
  if (screen === 'OTP')              return <OTPScreen navigate={navigate} params={screenParams} />;
  if (screen === 'RegistroConductor') return <RegistroConductorScreen navigate={navigate} params={screenParams} />;
  if (screen === 'PantallaPendiente') return <PantallaPendienteScreen />;

  if (screen === 'EnServicio') {
    return <EnServicioScreen params={screenParams} goHome={() => navigate('App')} />;
  }

  return (
    <View style={s.root}>
      {activeTab === 'Home'      && <HomeScreen navigate={navigate} />}
      {activeTab === 'Ganancias' && <GananciasScreen />}
      {activeTab === 'Actividad' && <ActividadScreen />}
      {activeTab === 'Cuenta'    && <CuentaScreen />}
      <TabBar active={activeTab} onPress={setActiveTab} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
