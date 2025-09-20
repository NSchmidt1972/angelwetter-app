import { useEffect } from 'react';
import { initOneSignal } from '../onesignal/OneSignalLoader';
import { enqueueOneSignal } from '@/onesignal/deferred';

export default function useOneSignal() {
  useEffect(() => {
    initOneSignal().catch(console.error);
  }, []);

  async function withOneSignal(callback) {
    return enqueueOneSignal(callback);
  }

  return {
    isPushEnabled: () => withOneSignal((OneSignal) => OneSignal.isPushNotificationsEnabled()),
    getUserId: () => withOneSignal((OneSignal) => OneSignal.getUserId()),
    showPrompt: () => withOneSignal((OneSignal) => OneSignal.showSlidedownPrompt()),
  };
}
