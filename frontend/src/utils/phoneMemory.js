// frontend/src/utils/phoneMemory.js

const KEY = 'last_phone_number';

export function getLastPhone() {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    console.debug('getLastPhone: storage not available', e);
    return null;
  }
}

export function setLastPhone(phone) {
  try {
    if (!phone) {
      localStorage.removeItem(KEY);
      return;
    }
    localStorage.setItem(KEY, String(phone));
  } catch (e) {
    console.debug('setLastPhone: storage not available', e);
  }
}
