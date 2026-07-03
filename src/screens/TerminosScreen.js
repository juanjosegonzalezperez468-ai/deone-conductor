import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { authApi } from '../api/client';
import { getUserUuid } from '../utils/tokenStorage';

const C = {
  bg:     '#F8F8F8',
  white:  '#FFFFFF',
  black:  '#111111',
  yellow: '#FFC400',
  gray:   '#757575',
  border: '#EEEEEE',
};

export default function TerminosScreen({ navigate }) {
  const [loading, setLoading] = useState(false);
  const [leido,   setLeido]   = useState(false);
  const scrollRef             = useRef(null);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const llegóAlFinal =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (llegóAlFinal) setLeido(true);
  };

  const handleAceptar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const uuid = await getUserUuid();
      await authApi.aceptarTerminos(uuid);
      navigate('App');
    } catch {
      Alert.alert('Error', 'No se pudo registrar tu aceptación. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      <View style={s.header}>
        <Text style={s.titulo}>Términos y Privacidad</Text>
        <Text style={s.subtitulo}>Lee hasta el final para continuar</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.content}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        showsVerticalScrollIndicator
      >
        <Text style={s.seccion}>POLÍTICA DE PRIVACIDAD Y TÉRMINOS DE USO{'\n'}CONDUCTORES DEONE</Text>
        <Text style={s.fecha}>Última actualización: julio de 2026</Text>

        <Text style={s.parrafo}>
          DEONE es una plataforma tecnológica de intermediación que conecta conductores
          independientes con usuarios que solicitan servicios de transporte en las ciudades
          de Colombia donde DEONE opera. Al registrarte como conductor aceptas los siguientes
          términos.
        </Text>

        <Text style={s.titulo2}>1. DATOS QUE RECOLECTAMOS</Text>
        <Text style={s.parrafo}>
          Recolectamos la siguiente información para operar la plataforma:{'\n\n'}
          • Número de teléfono: para verificar tu identidad mediante código OTP.{'\n'}
          • Nombre completo: para identificarte ante los usuarios.{'\n'}
          • Ubicación en tiempo real: para conectarte con solicitudes cercanas y mostrar
          tu posición al cliente durante el servicio.{'\n'}
          • Documentos de verificación: licencia de conducción, cédula y documentos del
          vehículo, para validar tu habilitación como conductor.{'\n'}
          • Historial de servicios: para calcular comisiones, calificaciones y estadísticas
          de desempeño.
        </Text>

        <Text style={s.titulo2}>2. USO DE TUS DATOS</Text>
        <Text style={s.parrafo}>
          Tus datos se usan exclusivamente para:{'\n\n'}
          • Conectarte con usuarios que solicitan servicios en tu zona.{'\n'}
          • Calcular y descontar comisiones por los servicios completados.{'\n'}
          • Verificar tu identidad y habilitación como conductor.{'\n'}
          • Enviarte notificaciones sobre nuevas solicitudes y estados de viaje.{'\n'}
          • Gestionar tu saldo, recargas y penalizaciones.{'\n\n'}
          No vendemos ni compartimos tus datos con terceros con fines comerciales.
          Solo los compartimos con el usuario asignado a tu servicio (nombre y teléfono)
          y con proveedores técnicos necesarios (Firebase de Google para autenticación y
          notificaciones, Supabase para almacenamiento de datos).
        </Text>

        <Text style={s.titulo2}>3. UBICACIÓN</Text>
        <Text style={s.parrafo}>
          La aplicación accede a tu ubicación mientras está en primer plano para mostrarte
          solicitudes cercanas y para que el cliente pueda seguir tu recorrido durante el
          servicio. No accedemos a tu ubicación en segundo plano cuando no tienes un servicio
          activo. Puedes revocar este permiso en la configuración del dispositivo, aunque esto
          impedirá el uso de la app.
        </Text>

        <Text style={s.titulo2}>4. COMISIONES Y SALDO</Text>
        <Text style={s.parrafo}>
          DEONE cobra una comisión del 8,5% sobre el valor de cada servicio completado
          (7% si completas más de 20 servicios en el mes). Esta comisión se descuenta
          automáticamente de tu saldo al finalizar cada viaje.{'\n\n'}
          Debes mantener un saldo mínimo para seguir recibiendo solicitudes. Si tu saldo
          cae por debajo del mínimo, tu cuenta se pausará automáticamente hasta que
          realices una recarga. Las recargas se solicitan desde la app y son aprobadas
          por el equipo de DEONE.
        </Text>

        <Text style={s.titulo2}>5. CANCELACIONES Y PENALIZACIONES</Text>
        <Text style={s.parrafo}>
          Cancelar servicios de forma reiterada afecta tu calificación y puede resultar
          en la suspensión temporal o definitiva de tu cuenta. DEONE se reserva el derecho
          de suspender cuentas con patrones de cancelación abusivos o comportamientos que
          afecten la experiencia de los usuarios.
        </Text>

        <Text style={s.titulo2}>6. RELACIÓN LABORAL</Text>
        <Text style={s.parrafo}>
          Los conductores son personas independientes y no empleados de DEONE. DEONE actúa
          exclusivamente como intermediario tecnológico. El conductor es responsable de
          cumplir con toda la normativa de tránsito, seguridad vial y transporte aplicable,
          así como de contar con los documentos y seguros requeridos por la ley colombiana.
        </Text>

        <Text style={s.titulo2}>7. RETENCIÓN Y ELIMINACIÓN DE DATOS</Text>
        <Text style={s.parrafo}>
          Conservamos tus datos mientras mantengas una cuenta activa en DEONE. Puedes
          solicitar la eliminación de tu cuenta y sus datos asociados escribiendo a
          soporte@deone.co. Procederemos dentro de los 15 días hábiles siguientes a
          la solicitud.
        </Text>

        <Text style={s.titulo2}>8. DERECHOS BAJO LA LEY 1581 DE 2012</Text>
        <Text style={s.parrafo}>
          De conformidad con la Ley de Protección de Datos Personales de Colombia tienes
          derecho a:{'\n\n'}
          • Conocer, actualizar y rectificar tus datos personales.{'\n'}
          • Solicitar prueba de la autorización otorgada.{'\n'}
          • Ser informado sobre el uso dado a tus datos.{'\n'}
          • Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).{'\n'}
          • Revocar la autorización y solicitar la supresión de tus datos.
        </Text>

        <Text style={s.titulo2}>9. MODIFICACIONES</Text>
        <Text style={s.parrafo}>
          DEONE puede actualizar estos términos en cualquier momento. En caso de cambios
          sustanciales, te notificaremos dentro de la aplicación y solicitaremos una nueva
          aceptación.
        </Text>

        <Text style={s.titulo2}>10. CONTACTO</Text>
        <Text style={s.parrafo}>
          Para consultas sobre privacidad o datos personales:{'\n'}
          soporte@deone.co
        </Text>

        <View style={s.finalMarker}>
          <Text style={s.finalTxt}>— Fin del documento —</Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        {!leido && (
          <Text style={s.scrollHint}>Desplázate hasta el final para habilitar el botón</Text>
        )}
        <TouchableOpacity
          style={leido && !loading ? s.btnAceptar : s.btnDis}
          onPress={handleAceptar}
          activeOpacity={0.85}
          disabled={!leido || loading}
        >
          {loading
            ? <ActivityIndicator color={C.black} size="small" />
            : <Text style={s.btnTxt}>ACEPTO Y CONTINUAR</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.white },
  header: {
    paddingHorizontal: 24,
    paddingTop:        56,
    paddingBottom:     16,
    backgroundColor:   C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  titulo:    { fontSize: 22, fontWeight: '800', color: C.black, marginBottom: 4 },
  subtitulo: { fontSize: 13, color: C.gray },

  scroll:  { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },

  seccion: {
    fontSize:      14,
    fontWeight:    '800',
    color:         C.black,
    letterSpacing: 0.5,
    marginBottom:  4,
    textAlign:     'center',
  },
  fecha: {
    fontSize:     12,
    color:        C.gray,
    textAlign:    'center',
    marginBottom: 20,
  },
  titulo2: {
    fontSize:     13,
    fontWeight:   '700',
    color:        C.black,
    marginTop:    20,
    marginBottom: 8,
  },
  parrafo: {
    fontSize:   13,
    color:      '#333333',
    lineHeight: 21,
  },
  finalMarker: {
    marginTop:    28,
    marginBottom: 8,
    alignItems:   'center',
  },
  finalTxt: { fontSize: 12, color: C.gray },

  footer: {
    paddingHorizontal: 20,
    paddingTop:        12,
    paddingBottom:     36,
    backgroundColor:   C.white,
    borderTopWidth:    1,
    borderTopColor:    C.border,
  },
  scrollHint: {
    fontSize:     12,
    color:        C.gray,
    textAlign:    'center',
    marginBottom: 10,
  },
  btnAceptar: {
    backgroundColor: C.yellow,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnDis: {
    backgroundColor: C.border,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnTxt: { color: C.black, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
