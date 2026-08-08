import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { soporteApi } from '../api/client';
import { C, SHADOW } from '../constants/theme';

// Cada cuánto se recarga la conversación mientras la pantalla está abierta.
// El soporte no es tiempo real: quien escribe espera minutos, no segundos.
const POLL_MS = 15000;

const hora = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

export default function SoporteScreen({ onBack }) {
  const [conversacion, setConversacion] = useState(null);
  const [mensajes,     setMensajes]     = useState([]);
  const [texto,        setTexto]        = useState('');
  const [cargando,     setCargando]     = useState(true);
  const [enviando,     setEnviando]     = useState(false);
  const [error,        setError]        = useState(null);
  const scrollRef = useRef(null);

  const cargar = useCallback(async (silencioso) => {
    if (!silencioso) setCargando(true);
    try {
      const { data } = await soporteApi.miConversacion();
      setConversacion(data.conversacion || null);
      setMensajes(data.mensajes || []);
      setError(null);
    } catch (e) {
      // En el primer intento se avisa; en los refrescos silenciosos no, para
      // no tapar la conversación con un error por un bache de red.
      if (!silencioso) setError('No se pudo cargar la conversación.');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(false);
    const iv = setInterval(() => cargar(true), POLL_MS);
    return () => clearInterval(iv);
  }, [cargar]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || enviando) return;
    setEnviando(true);
    // Se pinta de inmediato: si el envío falla se retira y se avisa. Esperar
    // al servidor con el campo vacío da sensación de que se perdió.
    const provisional = {
      id: `tmp-${Date.now()}`, autor: 'usuario', mensaje: msg,
      created_at: new Date().toISOString(),
    };
    setMensajes((prev) => [...prev, provisional]);
    setTexto('');
    try {
      await soporteApi.enviar(msg);
      await cargar(true);
    } catch (e) {
      setMensajes((prev) => prev.filter((m) => m.id !== provisional.id));
      setTexto(msg);
      Alert.alert(
        'No se pudo enviar',
        e?.response?.data?.detail || 'Revisa tu conexión e intenta de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const cerrada = conversacion?.estado === 'cerrada';

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Soporte Deone</Text>
          <Text style={s.subtitle}>
            {cerrada ? 'Caso cerrado' : 'Normalmente respondemos en unas horas'}
          </Text>
        </View>
      </View>

      {cargando ? (
        <View style={s.centro}><ActivityIndicator color={C.yellow} size="large" /></View>
      ) : error ? (
        <View style={s.centro}>
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity onPress={() => cargar(false)} style={s.reintentar} activeOpacity={0.8}>
            <Text style={s.reintentarTxt}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.lista}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {!mensajes.length && (
            <View style={s.vacio}>
              <Text style={s.vacioIcon}>💬</Text>
              <Text style={s.vacioTitulo}>¿En qué te ayudamos?</Text>
              <Text style={s.vacioTxt}>
                Escríbenos tu situación y el equipo de Deone te responde por aquí
                mismo. Puedes contarnos problemas con un servicio, con tu cuenta
                o con un pago.
              </Text>
            </View>
          )}

          {mensajes.map((m) => {
            const mio = m.autor === 'usuario';
            return (
              <View key={m.id} style={[s.fila, mio ? s.filaMia : s.filaSuya]}>
                <View style={[s.burbuja, mio ? s.burbujaMia : s.burbujaSuya]}>
                  {!mio && <Text style={s.autorSoporte}>Equipo Deone</Text>}
                  <Text style={mio ? s.txtMio : s.txtSuyo}>{m.mensaje}</Text>
                  <Text style={mio ? s.horaMia : s.horaSuya}>{hora(m.created_at)}</Text>
                </View>
              </View>
            );
          })}

          {cerrada && (
            <Text style={s.avisoCerrado}>
              Este caso se cerró. Si sigues necesitando ayuda, escribe de nuevo
              y lo reabrimos.
            </Text>
          )}
        </ScrollView>
      )}

      <View style={s.barra}>
        <TextInput
          style={s.input}
          placeholder="Escribe tu mensaje…"
          placeholderTextColor={C.gray}
          value={texto}
          onChangeText={setTexto}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={texto.trim() && !enviando ? s.btnEnviar : s.btnEnviarOff}
          onPress={enviar}
          disabled={!texto.trim() || enviando}
          activeOpacity={0.8}
        >
          {enviando
            ? <ActivityIndicator color={C.black} size="small" />
            : <Text style={s.btnEnviarTxt}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  backTxt: { fontSize: 32, color: C.black, marginTop: -6 },
  title:    { fontSize: 18, fontWeight: '800', color: C.black },
  subtitle: { fontSize: 12, color: C.gray, marginTop: 2 },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTxt: { color: C.gray, fontSize: 14, textAlign: 'center', marginBottom: 14 },
  reintentar: {
    backgroundColor: C.yellow, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  reintentarTxt: { fontWeight: '700', color: C.black },

  lista: { padding: 16, paddingBottom: 24 },
  vacio: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 12 },
  vacioIcon:   { fontSize: 44, marginBottom: 12 },
  vacioTitulo: { fontSize: 17, fontWeight: '800', color: C.black, marginBottom: 8 },
  vacioTxt:    { fontSize: 13, color: C.gray, textAlign: 'center', lineHeight: 20 },

  fila:     { flexDirection: 'row', marginBottom: 10 },
  filaMia:  { justifyContent: 'flex-end' },
  filaSuya: { justifyContent: 'flex-start' },
  burbuja:  { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, ...SHADOW },
  burbujaMia:  { backgroundColor: C.yellow, borderBottomRightRadius: 4 },
  burbujaSuya: { backgroundColor: C.white,  borderBottomLeftRadius: 4 },
  autorSoporte: { fontSize: 11, fontWeight: '800', color: C.gray, marginBottom: 3 },
  txtMio:   { fontSize: 14, color: C.black, lineHeight: 20 },
  txtSuyo:  { fontSize: 14, color: C.black, lineHeight: 20 },
  horaMia:  { fontSize: 10, color: 'rgba(0,0,0,0.45)', marginTop: 4, alignSelf: 'flex-end' },
  horaSuya: { fontSize: 10, color: C.gray, marginTop: 4, alignSelf: 'flex-end' },
  avisoCerrado: {
    fontSize: 12, color: C.gray, textAlign: 'center',
    marginTop: 16, paddingHorizontal: 20, lineHeight: 18,
  },

  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 22,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },
  input: {
    flex: 1, maxHeight: 110, backgroundColor: C.bg, borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 14, color: C.black,
  },
  btnEnviar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  btnEnviarOff: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnEnviarTxt: { fontSize: 17, color: C.black, fontWeight: '700' },
});
