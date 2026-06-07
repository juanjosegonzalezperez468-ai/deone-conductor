import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Linking, ActivityIndicator,
} from 'react-native';
import { conductorApi } from '../api/client';
import { getUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

const WHATSAPP_URL   = 'https://wa.me/573239420671';
const POLL_INTERVAL  = 10000;

export default function PantallaPendienteScreen({ navigate }) {
  const [rechazado, setRechazado] = useState(false);
  const [motivo,    setMotivo]    = useState('');
  const [checking,  setChecking]  = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        setChecking(true);
        const { data } = await conductorApi.estado(await getUserUuid());
        if (data?.estado_cuenta === 'activo') {
          navigate('App');
        } else if (data?.estado_cuenta === 'rechazado') {
          setMotivo(data.motivo_rechazo || 'Tu solicitud no fue aprobada.');
          setRechazado(true);
        }
      } catch {} finally {
        setChecking(false);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  /* ── Estado rechazado ── */
  if (rechazado) {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor={C.white} barStyle="dark-content" />

        <View style={s.card}>
          <View style={[s.iconWrap, s.iconRed]}>
            <Text style={s.icon}>❌</Text>
          </View>
          <Text style={s.title}>Solicitud rechazada</Text>
          <Text style={s.body}>
            {motivo}
          </Text>
        </View>

        <TouchableOpacity
          style={s.btn}
          onPress={() => Linking.openURL(WHATSAPP_URL)}
          activeOpacity={0.85}
        >
          <Text style={s.btnIcon}>💬</Text>
          <Text style={s.btnText}>Contactar soporte</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ── Estado pendiente ── */
  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      <View style={s.card}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>⏳</Text>
        </View>

        <Text style={s.title}>¡Registro enviado!</Text>
        <Text style={s.body}>
          Estamos verificando tus documentos.{'\n'}
          Te notificaremos cuando tu cuenta esté activa.
        </Text>

        {checking && (
          <View style={s.checkingRow}>
            <ActivityIndicator size="small" color={C.yellow} style={s.checkingSpinner} />
            <Text style={s.checkingTxt}>Verificando estado…</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={s.btn}
        onPress={() => Linking.openURL(WHATSAPP_URL)}
        activeOpacity={0.85}
      >
        <Text style={s.btnIcon}>💬</Text>
        <Text style={s.btnText}>Contactar soporte</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex:              1,
    backgroundColor:   C.white,
    paddingHorizontal: 28,
    justifyContent:    'center',
    paddingBottom:     60,
  },
  card: { alignItems: 'center', marginBottom: 48 },
  iconWrap: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: '#FFF9E6',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    28,
    ...SHADOW,
  },
  iconRed: { backgroundColor: C.redBg },
  icon:  { fontSize: 44 },
  title: {
    fontSize:     26,
    fontWeight:   '800',
    color:        C.black,
    textAlign:    'center',
    marginBottom: 16,
  },
  body: {
    fontSize:   15,
    color:      C.gray,
    textAlign:  'center',
    lineHeight: 24,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     20,
  },
  checkingSpinner: { marginRight: 8 },
  checkingTxt:     { color: C.gray, fontSize: 13 },
  btn: {
    flexDirection:   'row',
    backgroundColor: C.yellow,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    gap:             8,
  },
  btnIcon: { fontSize: 18 },
  btnText: { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },
});
