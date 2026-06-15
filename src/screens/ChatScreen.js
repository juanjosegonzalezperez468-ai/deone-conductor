import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { chatApi } from '../api/client';
import { getUserUuid } from '../utils/tokenStorage';
import { C, SHADOW } from '../constants/theme';

export default function ChatScreen({ serviceId, onClose }) {
  const uuidRef = useRef('');

  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto]       = useState('');
  const [enviando, setEnviando] = useState(false);

  const listRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMensajes = async () => {
    try {
      const { data } = await chatApi.getMensajes(serviceId, uuidRef.current);
      if (Array.isArray(data?.mensajes)) setMensajes(data.mensajes);
    } catch {}
  };

  useEffect(() => {
    getUserUuid().then((uuid) => {
      if (uuid) uuidRef.current = uuid;
      fetchMensajes();
      pollRef.current = setInterval(fetchMensajes, 3000);
    });
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (mensajes.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [mensajes]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || enviando) return;
    setTexto('');
    setEnviando(true);
    try {
      await chatApi.enviarMensaje(serviceId, uuidRef.current, msg);
      await fetchMensajes();
    } catch {}
    setEnviando(false);
  };

  const formatHora = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderMensaje = ({ item }) => {
    const mio = item.sender_id === uuidRef.current;
    return (
      <View style={mio ? s.rowMio : s.rowCliente}>
        <View style={mio ? s.bubbleMio : s.bubbleCliente}>
          <Text style={mio ? s.textoMio : s.textoCliente}>{item.mensaje}</Text>
        </View>
        <Text style={mio ? s.horaMio : s.horaCliente}>{formatHora(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.onlineDot} />
          <View>
            <Text style={s.headerTitle}>Chat con cliente</Text>
            <Text style={s.headerSub}>En línea</Text>
          </View>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={listRef}
          data={mensajes}
          keyExtractor={(item, i) => (item.id ?? i).toString()}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderMensaje}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={s.emptyTxt}>
                {'Aún no hay mensajes.\nEscribe para comunicarte con el cliente.'}
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={C.gray}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={texto.trim() && !enviando ? s.sendBtn : s.sendBtnDis}
            onPress={enviar}
            activeOpacity={0.85}
          >
            {enviando
              ? <ActivityIndicator color={C.black} size="small" />
              : <Text style={s.sendIcon}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  /* Header */
  header: {
    backgroundColor:   C.white,
    paddingTop:        52,
    paddingBottom:     14,
    paddingHorizontal: 20,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    ...SHADOW,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onlineDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: C.green,
  },
  headerTitle: { color: C.black, fontSize: 18, fontWeight: '800' },
  headerSub:   { color: C.gray,  fontSize: 12, marginTop: 1 },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeTxt: { color: C.black, fontSize: 16, fontWeight: '700' },

  /* Messages */
  listContent: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },

  rowMio: {
    alignItems:   'flex-end',
    marginBottom: 12,
  },
  rowCliente: {
    alignItems:   'flex-start',
    marginBottom: 12,
  },

  bubbleMio: {
    backgroundColor:       C.yellow,
    borderRadius:          18,
    borderBottomRightRadius: 4,
    paddingHorizontal:     14,
    paddingVertical:       10,
    maxWidth:              '75%',
  },
  bubbleCliente: {
    backgroundColor:      C.white,
    borderRadius:         18,
    borderBottomLeftRadius: 4,
    paddingHorizontal:    14,
    paddingVertical:      10,
    maxWidth:             '75%',
    borderWidth:          1,
    borderColor:          C.border,
  },
  textoMio:     { color: C.black, fontSize: 15, lineHeight: 21 },
  textoCliente: { color: C.black, fontSize: 15, lineHeight: 21 },

  horaMio:     { color: C.gray, fontSize: 11, marginTop: 4, marginRight: 2 },
  horaCliente: { color: C.gray, fontSize: 11, marginTop: 4, marginLeft: 2 },

  /* Empty */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTxt:  { color: C.gray, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  /* Input */
  inputWrap: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 12,
    paddingVertical:   10,
    paddingBottom:     28,
    backgroundColor:   C.white,
    borderTopWidth:    1,
    borderTopColor:    C.border,
    gap:               8,
  },
  input: {
    flex:              1,
    backgroundColor:   C.bg,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    fontSize:          15,
    color:             C.black,
    maxHeight:         100,
  },
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: C.yellow,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDis: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: C.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendIcon: { color: C.black, fontSize: 18, fontWeight: '700' },
});
