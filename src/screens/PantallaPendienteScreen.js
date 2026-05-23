import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Linking,
} from 'react-native';
import { C, SHADOW } from '../constants/theme';

const WHATSAPP_URL = 'https://wa.me/573239420671';

export default function PantallaPendienteScreen() {
  const handleSoporte = () => {
    Linking.openURL(WHATSAPP_URL);
  };

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
      </View>

      <TouchableOpacity style={s.btn} onPress={handleSoporte} activeOpacity={0.85}>
        <Text style={s.btnIcon}>💬</Text>
        <Text style={s.btnText}>Contactar soporte</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.white, paddingHorizontal: 28, justifyContent: 'center', paddingBottom: 60 },
  card:     { alignItems: 'center', marginBottom: 48 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFF9E6', justifyContent: 'center', alignItems: 'center', marginBottom: 28, ...SHADOW },
  icon:     { fontSize: 44 },
  title:    { fontSize: 26, fontWeight: '800', color: C.black, textAlign: 'center', marginBottom: 16 },
  body:     { fontSize: 15, color: C.gray, textAlign: 'center', lineHeight: 24 },
  btn:      { flexDirection: 'row', backgroundColor: C.yellow, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnIcon:  { fontSize: 18 },
  btnText:  { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },
});
