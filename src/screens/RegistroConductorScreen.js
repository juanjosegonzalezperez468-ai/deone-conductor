import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, StatusBar, ActivityIndicator,
  Alert, Modal,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { authApi, fcmApi } from '../api/client';
import { storeBackendToken, storePhone, storeUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

const VEHICLES = [
  { id: 'moto',    label: 'Moto',    icon: '🏍️' },
  { id: 'carro',   label: 'Carro',   icon: '🚗' },
  { id: 'acarreo', label: 'Acarreo', icon: '🚛' },
  { id: 'grua',    label: 'Grúa',    icon: '🔧' },
];

export default function RegistroConductorScreen({ navigate, params }) {
  const { user, phone } = params;
  const [nombre,      setNombre]      = useState('');
  const [vehiculo,    setVehiculo]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const valid = nombre.trim().length >= 3 && vehiculo !== null;

  const handleRegistrar = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const { data } = await authApi.verificarOtp({
        telefono:      phone,
        token:         idToken,
        nombre:        nombre.trim(),
        tipo_vehiculo: vehiculo,
        tipo:          'conductor',
      });
      await storeBackendToken(data.token);
      await storeUserUuid(data.usuario.id);
      await storePhone(phone);
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const pushToken = await Notifications.getDevicePushTokenAsync();
          await fcmApi.registrar(data.usuario.id, pushToken.data);
        }
      } catch {}
      setShowWelcome(true);
    } catch (err) {
      const errorMsg = err?.response?.data?.detail ||
                       err?.message ||
                       JSON.stringify(err);
      Alert.alert('Error registro', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar backgroundColor={C.white} barStyle="dark-content" />

        <Text style={s.title}>Registro de Conductor</Text>
        <Text style={s.subtitle}>Completa tu información para comenzar</Text>

        <Text style={s.label}>Nombre completo</Text>
        <TextInput
          style={s.input}
          placeholder="Ej. Juan Pérez"
          placeholderTextColor={C.gray}
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
          returnKeyType="done"
        />

        <Text style={s.label}>Tipo de vehículo</Text>
        <View style={s.vehicleGrid}>
          {VEHICLES.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={vehiculo === v.id ? s.vehicleCardSelected : s.vehicleCard}
              onPress={() => setVehiculo(v.id)}
              activeOpacity={0.8}
            >
              <Text style={s.vehicleIcon}>{v.icon}</Text>
              <Text style={vehiculo === v.id ? s.vehicleLabelSelected : s.vehicleLabel}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.notice}>
          <Text style={s.noticeIcon}>ℹ️</Text>
          <Text style={s.noticeText}>
            Tu cuenta será verificada por el equipo Deone antes de activarse.
          </Text>
        </View>

        <TouchableOpacity
          style={valid ? s.btn : s.btnDisabled}
          onPress={handleRegistrar}
          activeOpacity={0.85}
          disabled={!valid || loading}
        >
          {loading
            ? <ActivityIndicator color={C.black} />
            : <Text style={s.btnText}>REGISTRARME</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* ── Welcome Modal ── */}
      <Modal visible={showWelcome} transparent animationType="slide">
        <View style={s.welcomeOverlay}>
          <View style={s.welcomeCard}>
            <Text style={s.welcomeEmoji}>🎉</Text>
            <Text style={s.welcomeTitle}>¡Bienvenido a Deone!</Text>
            <Text style={s.welcomeBody}>
              Para empezar a recibir viajes necesitas:
            </Text>
            <View style={s.welcomeChecks}>
              <Text style={s.welcomeCheck}>✅  Completar tu documentación</Text>
              <Text style={s.welcomeCheck}>✅  Recargar tu saldo mínimo ($10.000)</Text>
            </View>
            <Text style={s.welcomeNote}>
              Sin estos pasos no podrás activarte.
            </Text>

            <TouchableOpacity
              style={s.welcomeBtnYellow}
              onPress={() => { setShowWelcome(false); navigate('PantallaPendiente'); }}
              activeOpacity={0.85}
            >
              <Text style={s.welcomeBtnYellowTxt}>Completar ahora</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.welcomeBtnGray}
              onPress={() => { setShowWelcome(false); navigate('PantallaPendiente'); }}
              activeOpacity={0.8}
            >
              <Text style={s.welcomeBtnGrayTxt}>Después</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: C.white },
  content:              { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  title:                { fontSize: 26, fontWeight: '800', color: C.black, marginBottom: 8 },
  subtitle:             { fontSize: 15, color: C.gray, marginBottom: 36, lineHeight: 22 },
  label:                { fontSize: 13, fontWeight: '600', color: C.black, marginBottom: 8 },
  input:                { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, height: 54, paddingHorizontal: 16, fontSize: 16, color: C.black, marginBottom: 28 },
  vehicleGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  vehicleCard:          { width: '47%', borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: C.white, ...SHADOW },
  vehicleCardSelected:  { width: '47%', borderWidth: 2, borderColor: C.yellow, borderRadius: 14, paddingVertical: 18, alignItems: 'center', backgroundColor: '#FFFBEA', ...SHADOW },
  vehicleIcon:          { fontSize: 28, marginBottom: 6 },
  vehicleLabel:         { fontSize: 14, fontWeight: '600', color: C.gray },
  vehicleLabelSelected: { fontSize: 14, fontWeight: '700', color: C.black },
  notice:               { flexDirection: 'row', backgroundColor: '#FFF9E6', borderRadius: 12, padding: 14, marginBottom: 32, gap: 10 },
  noticeIcon:           { fontSize: 16, marginTop: 1 },
  noticeText:           { flex: 1, fontSize: 13, color: '#7A5C00', lineHeight: 20 },
  btn:                  { backgroundColor: C.yellow, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnDisabled:          { backgroundColor: '#FFE082', borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnText:              { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },

  /* Welcome modal */
  welcomeOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent:  'flex-end',
    paddingHorizontal: 16,
    paddingBottom:   40,
  },
  welcomeCard: {
    backgroundColor: C.white,
    borderRadius:    28,
    padding:         28,
    alignItems:      'center',
    ...SHADOW,
  },
  welcomeEmoji: { fontSize: 52, marginBottom: 12 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: C.black, marginBottom: 10, textAlign: 'center' },
  welcomeBody:  { fontSize: 15, color: C.gray, marginBottom: 14, textAlign: 'center' },
  welcomeChecks:{ alignSelf: 'stretch', gap: 8, marginBottom: 14 },
  welcomeCheck: { fontSize: 14, fontWeight: '600', color: C.black, lineHeight: 22 },
  welcomeNote:  { fontSize: 13, color: C.gray, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  welcomeBtnYellow: {
    backgroundColor: C.yellow,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    alignSelf:       'stretch',
    marginBottom:    10,
  },
  welcomeBtnYellowTxt: { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },
  welcomeBtnGray: {
    backgroundColor: C.bg,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    alignSelf:       'stretch',
    borderWidth:     1,
    borderColor:     C.border,
  },
  welcomeBtnGrayTxt: { fontSize: 15, fontWeight: '600', color: C.gray },
});
