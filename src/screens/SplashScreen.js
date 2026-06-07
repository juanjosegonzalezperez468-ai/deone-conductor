import React, { useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import axios from 'axios';
import auth from '@react-native-firebase/auth';
import { API_URL } from '../constants/config';
import { getBackendToken, storeBackendToken, getPhone, getUserUuid, storeUserUuid } from '../utils/tokenStorage';
import { servicesApi } from '../api/client';
import { C } from '../constants/theme';

const ACTIVE_STATES = ['en_camino', 'en_servicio'];

export default function SplashScreen({ navigate }) {
  useEffect(() => {
    let resolved = false;
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (resolved) return;
      resolved = true;
      if (!user) { navigate('Login'); return; }
      try {
        const uuid = await getUserUuid();
        const jwt  = await getBackendToken();
        if (uuid && jwt) {
          try {
            const { data } = await servicesApi.conductor(uuid);
            const servicios = data.servicios || [];
            const activo = servicios.find(s => ACTIVE_STATES.includes(s.estado));
            if (activo) {
              navigate('EnServicio', {
                solicitud:      activo,
                precioAceptado: activo.precio_final || activo.precio_propuesto || 0,
              });
              return;
            }
          } catch {}
          navigate('App');
          return;
        }
        // Session exists but no backend tokens — restore silently
        const phone = await getPhone();
        if (!phone) { navigate('Login'); return; }
        const idToken = await user.getIdToken();
        const { data } = await axios.post(
          `${API_URL}/auth/verificar-otp`,
          { telefono: phone, token: idToken, tipo: 'conductor', nombre: 'conductor' },
          { headers: { 'Content-Type': 'application/json' } },
        );
        await storeBackendToken(data.token);
        await storeUserUuid(data.usuario.id);
        navigate('App');
      } catch {
        navigate('Login');
      }
    });
    return unsubscribe;
  }, []);

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />
      <Image source={require('../../assets/logo.png')} style={s.logo} />
      <ActivityIndicator size="small" color={C.yellow} style={s.spinner} />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  logo:    { width: 200, height: 200, resizeMode: 'contain' },
  spinner: { marginTop: 48 },
});
