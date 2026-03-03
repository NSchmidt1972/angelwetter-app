// onesignal/OneSignalLoader.js

// === Konfiguration ===
const ONESIGNAL_APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID?.trim() ||
  'b05a44e8-bea5-4941-8972-5194254aadad';

// Wenn VitePWA deinen SW als /sw.js ausliefert, bleibt das so:
const SW_PATH = 'OneSignalSDKWorker.js';
const SW_SCOPE = '/';

// Internes "nur einmal initialisieren" Flag
let initialized = false;

// Hilfsfunktion: SDK-Script laden (v16 – empfohlen)
function loadSdk() {
  return new Promise((resolve, reject) => {
    if (window.OneSignalDeferred) {
      resolve();
      return;
    }
    // v16: .page.js + defer
    const s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) =>
      reject(new Error('OneSignal SDK konnte nicht geladen werden: ' + (e?.message || '')));
    document.head.appendChild(s);

    // Stelle die Deferred-Queue bereit, bevor das SDK geladen ist
    window.OneSignalDeferred = window.OneSignalDeferred || [];
  });
}

/**
 * Initialisiert OneSignal inkl. Glocke.
 * - Nutzt deinen bestehenden Service Worker (sw.js), der OneSignal importiert.
 * - Die Glocke wird nicht auf Auth-/PW-Seiten angezeigt (displayPredicate).
 */
export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  try {
    await loadSdk();

    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,

          // Service Worker angeben (verwende deinen eigenen sw.js)
          serviceWorkerParam: { scope: SW_SCOPE },
          serviceWorkerPath: SW_PATH,

          // Glocke (Subscription Bell) aktivieren
          notifyButton: {
            enable: true,
            position: 'bottom-right',
            size: 'medium',
            prenotify: true, // kleine "1" vor Abo
            showCredit: false,
            // Glocke nicht auf Auth/Passwort-Seiten
            displayPredicate: async () => {
              const path = window.location.pathname;
              const block = [
                '/auth',
                '/update-password',
                '/reset-done',
                '/auth-verified',
                '/forgot-password',
              ];
              return !block.includes(path);
            },
            text: {
              'tip.state.unsubscribed': 'Benachrichtigungen aktivieren',
              'tip.state.subscribed': 'Benachrichtigungen aktiviert',
              'tip.state.blocked': 'Benachrichtigungen blockiert',
              'message.prenotify': 'Klick für Push-Benachrichtigungen',
              'message.action.subscribed': 'Danke fürs Abonnieren!',
              'message.action.resubscribed': 'Abo aktualisiert',
              'message.action.unsubscribed': 'Abo beendet',
            },
            offset: { bottom: '24px', right: '20px' },
          },

          // Keine Auto-Prompts – du entscheidest selbst, wann du fragst
          promptOptions: { slidedown: { prompts: [] } },

          // Optional: Welcome Notification abschalten (oder anpassen)
          welcomeNotification: { disable: true },

          // Optional: bei Cache-Löschung wieder anmelden
          autoResubscribe: true,
        });

        // ——— Events / Debug (optional) ———
        OneSignal.Notifications.addEventListener('click', () => {
          // console.log('[OneSignal] Notification click');
        });
        OneSignal.Notifications.addEventListener('display', () => {
          // console.log('[OneSignal] Notification display');
        });

        // Falls gewünscht: Angler-Tags setzen (Segmentierung)
        try {
          const name = localStorage.getItem('anglerName');
          if (name) {
            await OneSignal.User.addTag('angler', name);
          }
        } catch (tagErr) {
          console.warn('[OneSignal] Konnte Tag nicht setzen:', tagErr);
        }
      } catch (err) {
        console.error('[OneSignal] Init-Fehler:', err);
      }
    });
  } catch (e) {
    console.error('[OneSignal] SDK-Ladefehler:', e);
  }
}

// === Helfer-Funktionen ===

/**
 * Fragt aktiv die Push-Erlaubnis ab (z. B. via Button "🔔 Benachrichtigungen aktivieren").
 * Rückgabe: true bei Erfolg, sonst false
 */
export async function requestPushPermission() {
  if (!window.OneSignalDeferred) return false;
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        const res = await OneSignal.Notifications.requestPermission();
        if (typeof res === 'string') {
          resolve(res === 'granted');
          return;
        }
        resolve(Boolean(res));
      } catch (e) {
        console.warn('[OneSignal] requestPermission error:', e);
        resolve(false);
      }
    });
  });
}

/**
 * Kategorie-Prompt (Slidedown mit Kategorien) anzeigen.
 * Nutze dafür zuvor Kategorien im Dashboard oder via promptOptions.
 */
export async function promptCategories() {
  if (!window.OneSignalDeferred) return false;
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.Slidedown.promptPushCategories();
        resolve(true);
      } catch (e) {
        console.warn('[OneSignal] Category prompt error:', e);
        resolve(false);
      }
    });
  });
}

/**
 * OneSignal Player-/User-ID auslesen (für Backend-Zuordnung).
 */
export async function getPlayerId() {
  if (!window.OneSignalDeferred) return null;
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        const id = await OneSignal.User.getId();
        resolve(id || null);
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Prüfen, ob Push unterstützt wird und ob die Seite die Berechtigung hat.
 * Rückgabe: { supported: boolean, permission: boolean }
 */
export async function getPermissionState() {
  if (!window.OneSignalDeferred) return { supported: false, permission: false };
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        const supported = await OneSignal.Notifications.isPushSupported();
        const permission = !!OneSignal.Notifications.permission;
        resolve({ supported, permission });
      } catch (e) {
        console.warn('[OneSignal] Permission check error:', e);
        resolve({ supported: false, permission: false });
      }
    });
  });
}

/**
 * Ist der/die Nutzer:in effektiv für Push „eingeschaltet“?
 * (Abo vorhanden und nicht opt-out)
 */
export async function isOptedIn() {
  if (!window.OneSignalDeferred) return false;
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        const subId = await OneSignal.User.PushSubscription.id;
        const token = await OneSignal.User.PushSubscription.token;
        const permission = !!OneSignal.Notifications.permission;
        resolve(Boolean(subId && token && permission));
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * User-Tags setzen (z. B. { role: 'admin' } oder { angler: 'Max' }).
 */
export async function setUserTag(key, value) {
  if (!window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.User.addTag(key, value);
    } catch (e) {
      console.warn('[OneSignal] Tagging error:', e);
    }
  });
}

/**
 * Mehrere Tags auf einmal setzen.
 */
export async function setUserTags(tagsObj) {
  if (!window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.User.addTags(tagsObj);
    } catch (e) {
      console.warn('[OneSignal] addTags error:', e);
    }
  });
}

/**
 * Glocke „kontextuell“ anzeigen/ausblenden lassen (per displayPredicate-Neub bewerten).
 * Praktisch, wenn du z. B. auf manchen Routen nicht anzeigen willst:
 * - Aufruf einfach nach einem Route-Change.
 */
export async function showBellIf(predicateFn) {
  if (!window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      // Der einfachste Weg ist, die Seite/Route neu zu bewerten:
      // Wir triggern eine Re-Init der Bell-Konfiguration, indem wir notifyButton
      // kurz deaktivieren/aktivieren (SDK zeigt die Bell dann entsprechend dem predicate).
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerParam: { scope: SW_SCOPE },
        serviceWorkerPath: SW_PATH,
        notifyButton: {
          enable: true,
          displayPredicate: async () => {
            try {
              return !!(await predicateFn());
            } catch {
              return false;
            }
          },
        },
        promptOptions: { slidedown: { prompts: [] } },
        welcomeNotification: { disable: true },
        autoResubscribe: true,
      });
    } catch (e) {
      console.warn('[OneSignal] showBellIf error:', e);
    }
  });
}

/**
 * (Optional) Eigene Nutzer-ID mit OneSignal verknüpfen (z. B. Supabase-UID/Email).
 */
export async function loginUser(externalId) {
  if (!window.OneSignalDeferred || !externalId) return;
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.login(String(externalId));
    } catch (e) {
      console.warn('[OneSignal] login error:', e);
    }
  });
}

/** (Optional) Verknüpfung wieder lösen */
export async function logoutUser() {
  if (!window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.logout();
    } catch (e) {
      console.warn('[OneSignal] logout error:', e);
    }
  });
}
