import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { authApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';

const VEHICLES = [
  { id: 'moto',    label: 'Moto',    icon: '🏍️' },
  { id: 'carro',   label: 'Carro',   icon: '🚗' },
  { id: 'acarreo', label: 'Acarreo', icon: '🚛' },
  { id: 'grua',    label: 'Grúa',    icon: '🔧' },
];

export default function RegistroConductorScreen({ navigate, params }) {
  const { user, phone } = params;
  const [nombre,   setNombre]   = useState('');
  const [vehiculo, setVehiculo] = useState(null);
  const [loading,  setLoading]  = useState(false);

  const valid = nombre.trim().length >= 3 && vehiculo !== null;

  const handleRegistrar = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await authApi.verificarOtp({
        phone,
        uid:          user.uid,
        nombre:       nombre.trim(),
        tipo_vehiculo: vehiculo,
        tipo:         'conductor',
      });
      navigate('PantallaPendiente');
    } catch {
      Alert.alert('Error', 'No pudimos completar el registro. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
});
