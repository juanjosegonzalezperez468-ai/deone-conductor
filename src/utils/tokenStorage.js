import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_JWT   = 'backend_jwt';
const KEY_PHONE = 'user_phone';
const KEY_UUID  = 'user_uuid';

export const storeBackendToken = (token) => AsyncStorage.setItem(KEY_JWT, token);
export const getBackendToken   = ()      => AsyncStorage.getItem(KEY_JWT);
export const clearBackendToken = ()      => AsyncStorage.removeItem(KEY_JWT);

export const storePhone = (phone) => AsyncStorage.setItem(KEY_PHONE, phone);
export const getPhone   = ()      => AsyncStorage.getItem(KEY_PHONE);
export const clearPhone = ()      => AsyncStorage.removeItem(KEY_PHONE);

export const storeUserUuid = (uuid) => AsyncStorage.setItem(KEY_UUID, uuid);
export const getUserUuid   = ()     => AsyncStorage.getItem(KEY_UUID);
export const clearUserUuid = ()     => AsyncStorage.removeItem(KEY_UUID);
