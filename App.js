import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform,
} from 'react-native';
import auth                        from '@react-native-firebase/auth';
import * as Notifications          from 'expo-notifications';
import * as Device                 from 'expo-device';
import { fcmApi, conductorApi }    from './src/api/client';
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
const DRAWER_W    = Dimensions.get('window').width * 0.82;

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

function DrawerItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={di.item} onPress={onPress} activeOpacity={0.7}>
      <Text style={di.icon}>{icon}</Text>
      <Text style={di.label}>{label}</Text>
      <Text style={di.arrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [screen,          setScreen]          = useState('Splash');
  const [screenParams,    setScreenParams]    = useState({});
  const [isAdmin,         setIsAdmin]         = useState(false);
  const [disponible,      setDisponible]      = useState(false);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [conductorNombre, setConductorNombre] = useState('');
  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setIsAdmin(user?.phoneNumber === ADMIN_PHONE);
      if (user) {
        registrarFCMToken();
        getUserUuid().then(uuid => {
          if (!uuid) return;
          conductorApi.perfil(uuid)
            .then(({ data }) => { if (data?.nombre) setConductorNombre(data.nombre); })
            .catch(() => {});
        });
      }
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

  const abrirDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const cerrarDrawer = (cb) => {
    Animated.timing(drawerAnim, { toValue: -DRAWER_W, duration: 200, useNativeDriver: true })
      .start(() => { setDrawerOpen(false); if (cb) cb(); });
  };

  const irA = (pantalla) => cerrarDrawer(() => navigate(pantalla));

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

  let mainContent;
  if (screen === 'Ganancias') {
    mainContent = <GananciasScreen navigate={navigate} onMenuPress={abrirDrawer} />;
  } else if (screen === 'Actividad') {
    mainContent = <ActividadScreen navigate={navigate} onMenuPress={abrirDrawer} />;
  } else if (screen === 'Cuenta') {
    mainContent = <CuentaScreen navigate={navigate} onMenuPress={abrirDrawer} />;
  } else if (screen === 'Admin') {
    mainContent = <AdminScreen navigate={navigate} onMenuPress={abrirDrawer} />;
  } else {
    mainContent = (
      <SolicitudesScreen
        navigate={navigate}
        isAdmin={isAdmin}
        disponible={disponible}
        onDisponibleChange={setDisponible}
        onMenuPress={abrirDrawer}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {mainContent}

      {drawerOpen && (
        <>
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, dr.dim]}
            onPress={() => cerrarDrawer()}
            activeOpacity={1}
          />
          <Animated.View style={[dr.panel, { transform: [{ translateX: drawerAnim }] }]}>
            <View style={dr.perfil}>
              <View style={dr.avatar}>
                <Text style={dr.avatarTxt}>
                  {(conductorNombre || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={dr.nombre} numberOfLines={1}>
                {conductorNombre || 'Conductor'}
              </Text>
              <Text style={dr.sub}>Conductor Deone</Text>
            </View>

            <View style={dr.sep} />

            <DrawerItem icon="🏠" label="Inicio"    onPress={() => irA('App')} />
            <DrawerItem icon="💰" label="Ganancias" onPress={() => irA('Ganancias')} />
            <DrawerItem icon="📋" label="Actividad"  onPress={() => irA('Actividad')} />
            <DrawerItem icon="👤" label="Cuenta"     onPress={() => irA('Cuenta')} />
            {isAdmin && (
              <DrawerItem icon="🛡️" label="Admin" onPress={() => irA('Admin')} />
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const dr = StyleSheet.create({
  dim: {
    backgroundColor: 'rgba(0,0,0,0.50)',
    zIndex:          50,
  },
  panel: {
    position:        'absolute',
    top:             0,
    left:            0,
    bottom:          0,
    width:           DRAWER_W,
    backgroundColor: '#FFFFFF',
    zIndex:          60,
    paddingTop:      60,
    shadowColor:     '#000',
    shadowOffset:    { width: 6, height: 0 },
    shadowOpacity:   0.15,
    shadowRadius:    16,
    elevation:       20,
  },
  perfil: {
    paddingHorizontal: 24,
    paddingBottom:     24,
  },
  avatar: {
    width:           68,
    height:          68,
    borderRadius:    34,
    backgroundColor: '#FFD600',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    14,
  },
  avatarTxt: { color: '#111', fontSize: 30, fontWeight: '900' },
  nombre:    { color: '#111', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sub:       { color: '#888', fontSize: 13 },
  sep:       { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16, marginBottom: 8 },
});

const di = StyleSheet.create({
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   18,
  },
  icon:  { fontSize: 22, marginRight: 16, width: 30, textAlign: 'center' },
  label: { flex: 1, color: '#111', fontSize: 16, fontWeight: '600' },
  arrow: { color: '#888', fontSize: 22, fontWeight: '300' },
});
