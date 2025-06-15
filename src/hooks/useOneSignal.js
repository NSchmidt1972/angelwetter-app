import { useEffect } from 'react';
import { initOneSignal } from '../onesignal/OneSignalLoader';

export default function useOneSignal() {
  useEffect(() => {
    initOneSignal().catch(console.error);
  }, []);

  async function withOneSignal(callback) {
    return new Promise((resolve, reject) => {
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          const result = await callback(OneSignal);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  return {
    isPushEnabled: () => withOneSignal((OneSignal) => OneSignal.isPushNotificationsEnabled()),
    getUserId: () => withOneSignal((OneSignal) => OneSignal.getUserId()),
    showPrompt: () => withOneSignal((OneSignal) => OneSignal.showSlidedownPrompt()),
  };
}
