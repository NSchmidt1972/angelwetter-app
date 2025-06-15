import { useEffect } from 'react';
import { initOneSignal } from '../onesignal/OneSignalLoader';

export default function PushInit() {
  useEffect(() => {
    initOneSignal();
  }, []);

  return null;
}
