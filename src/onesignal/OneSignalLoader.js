import {
  ensureOneSignalInitialized,
  getPermissionState as getPermissionStateValue,
  getPushStatusSnapshot,
  getSubscriptionId,
  requestPushPermission as requestPermissionFromService,
  withOneSignal,
} from '@/onesignal/onesignalService';

// Legacy-kompatible Wrapper auf die zentrale OneSignal-Service-Schicht.
export async function initOneSignal() {
  return ensureOneSignalInitialized();
}

export async function requestPushPermission() {
  const permissionState = await requestPermissionFromService();
  return permissionState === 'granted';
}

export async function promptCategories() {
  return withOneSignal(async (OneSignal) => {
    if (typeof OneSignal?.Slidedown?.promptPushCategories !== 'function') {
      return false;
    }
    await OneSignal.Slidedown.promptPushCategories();
    return true;
  });
}

export async function getPlayerId() {
  return withOneSignal((OneSignal) => getSubscriptionId(OneSignal));
}

export async function getPermissionState() {
  return withOneSignal(async (OneSignal) => ({
    supported: !!(await getPushStatusSnapshot(OneSignal)).supported,
    permission: getPermissionStateValue(OneSignal) === 'granted',
  }));
}

export async function isOptedIn() {
  return withOneSignal(async (OneSignal) => {
    const snapshot = await getPushStatusSnapshot(OneSignal);
    return !!(snapshot.subId && snapshot.granted && snapshot.optedIn);
  });
}

export async function setUserTag(key, value) {
  return withOneSignal(async (OneSignal) => {
    if (!key) return;
    await OneSignal?.User?.addTag?.(key, value);
  });
}

export async function setUserTags(tagsObj) {
  return withOneSignal(async (OneSignal) => {
    if (!tagsObj || typeof tagsObj !== 'object') return;
    await OneSignal?.User?.addTags?.(tagsObj);
  });
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
  return withOneSignal(async (OneSignal) => {
    if (!externalId) return;
    await OneSignal?.login?.(String(externalId));
  });
}

export async function logoutUser() {
  return withOneSignal(async (OneSignal) => {
    await OneSignal?.logout?.();
  });
}
