import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform,
} from 'react-native';
import auth                        from '@react-native-firebase/auth';
import AsyncStorage                from '@react-native-async-storage/async-storage';
import * as Notifications          from 'expo-notifications';
import * as Device                 from 'expo-device';
import * as Location               from 'expo-location';
import * as Application            from 'expo-application';
import { fcmApi, conductorApi, servicesApi, locationsApi, vehiculoApi } from './src/api/client';
import { getUserUuid }             from './src/utils/tokenStorage';
import {
  iniciarUbicacionSegundoPlano, detenerUbicacionSegundoPlano, KEY_TIPO_SERVICIO,
} from './src/utils/backgroundLocation';
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
import ConductorDetalleScreen      from './src/screens/ConductorDetalleScreen';
import CreditoWEWINScreen          from './src/screens/CreditoWEWINScreen';
import ChatScreen                  from './src/screens/ChatScreen';
import TerminosScreen              from './src/screens/TerminosScreen';
import RutasScreen                 from './src/screens/RutasScreen';
import RutaActivaScreen            from './src/screens/RutaActivaScreen';

const ADMIN_PHONE     = '+573239420671';
const DRAWER_W        = Dimensions.get('window').width * 0.82;
const KEY_DISPONIBLE  = 'conductor_disponible';
const HEARTBEAT_MS    = 20000; // el backend marca desconectado tras 10 min sin ping

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
  const drawerAnim         = useRef(new Animated.Value(-DRAWER_W)).current;
  const tipoServicioRef    = useRef(null);
  const coordsRef          = useRef(null);
  const prevDisponibleRef  = useRef(false);

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
          vehiculoApi.obtener(uuid)
            .then(({ data }) => {
              if (data?.tipo_servicio) {
                tipoServicioRef.current = data.tipo_servicio;
                // La tarea de segundo plano lo lee de AsyncStorage
                AsyncStorage.setItem(KEY_TIPO_SERVICIO, data.tipo_servicio).catch(() => {});
              }
            })
            .catch(() => {});
        });
      }
    });
    return unsubscribe;
  }, []);

  // Restaurar el estado disponible/inactivo tras reiniciar la app: el toggle
  // solo cambia cuando el conductor lo cambia, no al matar/reabrir la app.
  useEffect(() => {
    AsyncStorage.getItem(KEY_DISPONIBLE)
      .then((v) => {
        if (v === 'true') setDisponible(true);
        // Si quedó un servicio de ubicación huérfano de una sesión anterior
        // con el toggle apagado, detenerlo.
        else detenerUbicacionSegundoPlano();
      })
      .catch(() => {});
  }, []);

  const cambiarDisponible = (val) => {
    setDisponible(val);
    AsyncStorage.setItem(KEY_DISPONIBLE, String(val)).catch(() => {});
  };

  // Heartbeat: mientras el conductor esté disponible, enviar la ubicación
  // periódicamente. Sin esto el backend lo marca desconectado a los 10 min
  // sin ping (deja de aparecer en el mapa admin y de recibir solicitudes).
  // Vive en App para que no muera al navegar entre pantallas. El servicio de
  // segundo plano cubre pantalla apagada/app minimizada; este heartbeat queda
  // como respaldo si el permiso "todo el tiempo" se niega.
  useEffect(() => {
    const eraDisponible = prevDisponibleRef.current;
    prevDisponibleRef.current = disponible;
    if (!disponible) {
      // Solo detener al pasar de disponible → inactivo; en el primer render
      // (antes de restaurar desde AsyncStorage) no hay que tocar el servicio.
      if (eraDisponible) detenerUbicacionSegundoPlano();
      return;
    }
    iniciarUbicacionSegundoPlano();
    let vivo = true;
    let watchSub = null;

    const enviarPing = async () => {
      const uuid = await getUserUuid();
      const coords = coordsRef.current;
      if (!vivo || !uuid || !coords) return;
      locationsApi.actualizar({
        conductor_id:      uuid,
        lat:               coords.latitude,
        lng:               coords.longitude,
        disponible:        true,
        servicios_activos: tipoServicioRef.current ? [tipoServicioRef.current] : [],
      }).catch(() => {});
    };

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        watchSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 20 },
          (loc) => { coordsRef.current = loc.coords; },
        );
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc) coordsRef.current = loc.coords;
        enviarPing();
      } catch {}
    })();

    const iv = setInterval(enviarPing, HEARTBEAT_MS);
    return () => { vivo = false; clearInterval(iv); watchSub?.remove?.(); };
  }, [disponible]);

  useEffect(() => {
    const handleResponse = async (response) => {
      const data = response?.notification?.request?.content?.data;
      // Notificaciones de rutas de reparto
      if (data?.ruta_id) {
        if (data?.screen === 'RutaEnCurso' || data?.screen === 'RutaFinalizada') {
          navigate('RutaActiva', { rutaId: data.ruta_id });
        } else {
          navigate('Rutas');
        }
        return;
      }
      if (data?.screen === 'EnServicio' && data?.service_id) {
        try {
          const { data: solicitud } = await servicesApi.obtener(data.service_id);
          if (solicitud?.estado === 'confirmado') {
            navigate('EnServicio', { solicitud, precioAceptado: solicitud.precio_final || 0 });
            return;
          }
        } catch {}
      }
      setScreen('App');
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
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
  if (screen === 'Terminos')          return <TerminosScreen navigate={navigate} />;
  if (screen === 'RegistroConductor') return <RegistroConductorScreen navigate={navigate} params={screenParams} />;
  if (screen === 'PantallaPendiente') return <PantallaPendienteScreen navigate={navigate} />;

  if (screen === 'EnServicio') {
    return <EnServicioScreen params={screenParams} goHome={() => navigate('App')} />;
  }
  if (screen === 'Chat') {
    return <ChatScreen serviceId={screenParams.serviceId} onClose={() => navigate('App')} />;
  }
  if (screen === 'DocumentosAdmin') {
    return <DocumentosAdminScreen params={screenParams} onBack={() => navigate('Admin')} />;
  }
  if (screen === 'ConductorDetalle') {
    return <ConductorDetalleScreen params={screenParams} navigate={navigate} onBack={() => navigate('Admin')} />;
  }
  if (screen === 'CreditoWEWIN') {
    return <CreditoWEWINScreen onBack={() => navigate('App')} />;
  }
  if (screen === 'RutaActiva') {
    return (
      <RutaActivaScreen
        params={screenParams}
        navigate={navigate}
        goHome={() => navigate('Rutas')}
      />
    );
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
  } else if (screen === 'Rutas') {
    mainContent = <RutasScreen navigate={navigate} onMenuPress={abrirDrawer} />;
  } else {
    mainContent = (
      <SolicitudesScreen
        navigate={navigate}
        isAdmin={isAdmin}
        disponible={disponible}
        onDisponibleChange={cambiarDisponible}
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
              <Text style={dr.version}>
                v{Application.nativeBuildVersion || '—'}
              </Text>
            </View>

            <View style={dr.sep} />

            <DrawerItem icon="🏠" label="Inicio"    onPress={() => irA('App')} />
            <DrawerItem icon="📦" label="Rutas"     onPress={() => irA('Rutas')} />
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
  version:   { color: '#BBB', fontSize: 11, marginTop: 2 },
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
