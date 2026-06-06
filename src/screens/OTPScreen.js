import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import * as Notifications from 'expo-notifications';
import { authApi, fcmApi } from '../api/client';
import { storeBackendToken, storePhone, storeUserUuid } from '../utils/tokenStorage';
import { C } from '../constants/theme';

export default function OTPScreen({ navigate, params }) {
  const { confirmation, phone } = params;
  const [digits,    setDigits]  = useState(['', '', '', '', '', '']);
  const [loading,   setLoading] = useState(false);
  const [resending, setResend]  = useState(false);
  const inputs = useRef([]);

  const code = digits.join('');
  const ready = code.length === 6;

  const handleChange = (text, index) => {
    const char = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerificar = async () => {
    if (!ready || loading) return;
    setLoading(true);
    try {
      const result = await confirmation.confirm(code);
      const isNew = result.additionalUserInfo?.isNewUser ?? false;
      await storePhone(phone);
      if (isNew) {
        navigate('RegistroConductor', { user: result.user, phone });
      } else {
        try {
          const idToken = await result.user.getIdToken();
          const { data } = await authApi.verificarOtp({
            telefono: phone,
            token:    idToken,
            tipo:     'conductor',
            nombre:   'conductor',
          });
          await storeBackendToken(data.token);
          await storeUserUuid(data.usuario.id);
          try {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status === 'granted') {
              const pushToken = await Notifications.getDevicePushTokenAsync();
              await fcmApi.registrar(data.usuario.id, pushToken.data);
            }
          } catch {}
          navigate('App');
        } catch {
          navigate('RegistroConductor', { user: result.user, phone });
        }
      }
    } catch {
      Alert.alert('Código incorrecto', 'El código ingresado no es válido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    if (resending) return;
    setResend(true);
    try {
      await auth().signInWithPhoneNumber(phone);
      Alert.alert('Código reenviado', `Enviamos un nuevo código a ${phone}`);
    } catch {
      Alert.alert('Error', 'No pudimos reenviar el código. Intenta más tarde.');
    } finally {
      setResend(false);
    }
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      <Text style={s.title}>Verifica tu número</Text>
      <Text style={s.subtitle}>
        Ingresa el código de 6 dígitos que enviamos a{'\n'}
        <Text style={s.phoneHighlight}>{phone}</Text>
      </Text>

      <View style={s.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputs.current[i] = r; }}
            style={d ? s.otpBoxFilled : s.otpBox}
            value={d}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity
        style={ready ? s.btn : s.btnDisabled}
        onPress={handleVerificar}
        activeOpacity={0.85}
        disabled={!ready || loading}
      >
        {loading
          ? <ActivityIndicator color={C.black} />
          : <Text style={s.btnText}>VERIFICAR</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.resendBtn} onPress={handleReenviar} disabled={resending}>
        {resending
          ? <ActivityIndicator size="small" color={C.gray} />
          : <Text style={s.resendText}>Reenviar código</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const BOX_SIZE = 48;

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.white },
  content:        { flexGrow: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 40 },
  title:          { fontSize: 26, fontWeight: '800', color: C.black, marginBottom: 12 },
  subtitle:       { fontSize: 15, color: C.gray, lineHeight: 22, marginBottom: 40 },
  phoneHighlight: { fontWeight: '700', color: C.black },
  otpRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 36 },
  otpBox:         { width: BOX_SIZE, height: BOX_SIZE + 10, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, fontSize: 22, fontWeight: '700', color: C.black, backgroundColor: C.white },
  otpBoxFilled:   { width: BOX_SIZE, height: BOX_SIZE + 10, borderWidth: 2, borderColor: C.yellow, borderRadius: 12, fontSize: 22, fontWeight: '700', color: C.black, backgroundColor: '#FFFBEA' },
  btn:            { backgroundColor: C.yellow, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  btnDisabled:    { backgroundColor: '#FFE082', borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  btnText:        { fontSize: 16, fontWeight: '800', color: C.black, letterSpacing: 0.5 },
  resendBtn:      { alignItems: 'center', paddingVertical: 12 },
  resendText:     { fontSize: 14, color: C.gray, textDecorationLine: 'underline' },
});
