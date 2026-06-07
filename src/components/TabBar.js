import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const BASE_TABS = [
  { key: 'Home',        label: 'Inicio',   icon: '🏠' },
  { key: 'Solicitudes', label: 'Carreras', icon: '🏍️' },
  { key: 'Ganancias',   label: 'Ganancias',icon: '💰' },
  { key: 'Actividad',   label: 'Actividad',icon: '📋' },
  { key: 'Cuenta',      label: 'Cuenta',   icon: '👤' },
];

const ADMIN_TAB = { key: 'Admin', label: 'Admin', icon: '🛡️' };

export default function TabBar({ active, onPress, isAdmin }) {
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <View style={s.bar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={s.tab}
          onPress={() => onPress(tab.key)}
          activeOpacity={0.7}
        >
          <Text style={s.icon}>{tab.icon}</Text>
          <Text style={active === tab.key ? s.labelActive : s.label}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection:  'row',
    backgroundColor:'#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop:     10,
    paddingBottom:  28,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: -2 },
    shadowOpacity:  0.06,
    shadowRadius:   8,
    elevation:      8,
  },
  tab:         { flex: 1, alignItems: 'center', gap: 2 },
  icon:        { fontSize: 22 },
  label:       { color: '#AAAAAA', fontSize: 10, fontWeight: '500' },
  labelActive: { color: '#111111', fontSize: 10, fontWeight: '700' },
});
