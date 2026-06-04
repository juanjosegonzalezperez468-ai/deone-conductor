import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ScrollView, StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { C } from '../constants/theme';

export default function LoginScreen({ navigate }) {
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);

  const valid = phone.replace(/\D/g, '').length >= 10;

  const handleContinuar = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, '');
      const confirmation = await auth().signInWithPhoneNumber('+57' + digits);
      navigate('OTP', { confirmation, phone: '+57' + digits });
    } catch (err) {
      const errorMsg = `CODE: ${err?.code}\nMSG: ${err?.message}\nFULL: ${JSON.stringify(err)}`;
      Alert.alert('Error Firebase', errorMsg);
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

      <Image source={require('../../assets/logo.png')} style={s.logo} />

      <Text style={s.title}>Acceso Conductores</Text>
      <Text style={s.subtitle}>Ingresa tu número para continuar</Text>

      <Text style={s.label}>Número de celular</Text>
      <View style={s.phoneRow}>
        <View style={s.prefixBox}>
          <Text style={s.prefixText}>+57</Text>
        </View>
        <TextInput
          style={s.phoneInput}
          placeholder="300 123 4567"
          placeholderTextColor={C.gray}
          keyboardType="number-pad"
          maxLength={12}
          value={phone}
          onChangeText={setPhone}
          returnKeyType="done"
          onSubmitEditing={handleContinuar}
        />
      </View>

      <TouchableOpacity
        style={valid ? s.btn : s.btnDisabled}
        onPress={handleContinuar}
        activeOpacity={0.85}
        disabled={!valid || loading}
      >
        {loading
          ? <ActivityIndicator color={C.black} />
          : <Text style={s.btnText}>CONTINUAR</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.white },
  content:     { flexGrow: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 40 },
  logo:        { width: 90, height: 90, resizeMode: 'contain', alignSelf: 'center', marginBottom: 36 },
  title:       { fontSize: 26, fontWeight: '800', color: C.black, textAlign: 'center', marginBottom: 8 },
  subtitle:    { fontSize: 15, color: C.gray, textAlign: 'center', marginBottom: 40, lineHeight: 22 },
  label:       { fontSize: 13, fontWeight: '600', color: C.black, marginBottom: 8 },
  phoneRow:    { flexDirection: 'row', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, overflow: 'hidden', height: 54, marginBottom: 32 },
  prefixBox:   { width: 64, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1.5, borderRightColor: C.border },
  prefixText:  { fontSize: 15, fontWeight: '700', color: C.black },
  phoneInput:  { flex: 1, paddingHorizontal: 14, fontSize: 16, color: C.black },
  btn:         { backgroundColor: C.yellow, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { backgroundColor: '#FFE082', borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnText:     { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },
});
