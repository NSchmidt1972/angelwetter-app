import {
  ensureOneSignalInitialized,
  getPermissionState as getPermissionStateValue,
  getPushStatusSnapshot,
  getSubscriptionId,
  isOneSignalEnabledForRuntime,
  requestPushPermission as requestPermissionFromService,
  withOneSignal,
} from '@/onesignal/onesignalService';

async function safeWithOneSignal(callback, fallbackValue = null) {
  if (!isOneSignalEnabledForRuntime()) return fallbackValue;
  try {
    return await withOneSignal(callback);
  } catch (err) {
    console.warn('[OneSignalLoader] Aufruf fehlgeschlagen:', err);
    return fallbackValue;
  }
}

// Legacy-kompatible Wrapper auf die zentrale OneSignal-Service-Schicht.
export async function initOneSignal() {
  if (!isOneSignalEnabledForRuntime()) return null;
  try {
    return await ensureOneSignalInitialized();
  } catch (err) {
    console.warn('[OneSignalLoader] initOneSignal fehlgeschlagen:', err);
    return null;
  }
}

export async function requestPushPermission() {
  if (!isOneSignalEnabledForRuntime()) return false;
  try {
    const permissionState = await requestPermissionFromService();
    return permissionState === 'granted';
  } catch (err) {
    console.warn('[OneSignalLoader] requestPushPermission fehlgeschlagen:', err);
    return false;
  }
}

export async function promptCategories() {
  return safeWithOneSignal(async (OneSignal) => {
    if (typeof OneSignal?.Slidedown?.promptPushCategories !== 'function') {
      return false;
    }
    await OneSignal.Slidedown.promptPushCategories();
    return true;
  }, false);
}

export async function getPlayerId() {
  return safeWithOneSignal((OneSignal) => getSubscriptionId(OneSignal), null);
}

export async function getPermissionState() {
  return safeWithOneSignal(async (OneSignal) => ({
    supported: !!(await getPushStatusSnapshot(OneSignal)).supported,
    permission: getPermissionStateValue(OneSignal) === 'granted',
  }), { supported: false, permission: false });
}

export async function isOptedIn() {
  return safeWithOneSignal(async (OneSignal) => {
    const snapshot = await getPushStatusSnapshot(OneSignal);
    return !!(snapshot.subId && snapshot.granted && snapshot.optedIn);
  }, false);
}

export async function setUserTag(key, value) {
  return safeWithOneSignal(async (OneSignal) => {
    if (!key) return;
    await OneSignal?.User?.addTag?.(key, value);
  }, null);
}

export async function setUserTags(tagsObj) {
  return safeWithOneSignal(async (OneSignal) => {
    if (!tagsObj || typeof tagsObj !== 'object') return;
    await OneSignal?.User?.addTags?.(tagsObj);
  }, null);
}

export async function showBellIf(predicateFn) {
  if (typeof predicateFn !== 'function') return false;
  try {
    return !!(await predicateFn());
  } catch {
    return false;
  }
}

export async function loginUser(externalId) {
  return safeWithOneSignal(async (OneSignal) => {
    if (!externalId) return;
    await OneSignal?.login?.(String(externalId));
  }, null);
}

export async function logoutUser() {
  return safeWithOneSignal(async (OneSignal) => {
    await OneSignal?.logout?.();
  }, null);
}
