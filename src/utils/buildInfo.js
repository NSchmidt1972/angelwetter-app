// utils/buildInfo.js
const BI = (typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__) || null;

const FALLBACKS = {
  version: (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || (import.meta.env && import.meta.env.VITE_APP_VERSION) || 'dev',
  date:    (typeof __BUILD_DATE__   !== 'undefined' && __BUILD_DATE__)   || (import.meta.env && import.meta.env.VITE_BUILD_DATE)   || '',
  commit:  (typeof __GIT_COMMIT__   !== 'undefined' && __GIT_COMMIT__)   || (import.meta.env && import.meta.env.VITE_GIT_COMMIT)   || '',
};

export const APP_VERSION = (BI && BI.version) || FALLBACKS.version;
export const BUILD_DATE = (BI && BI.date)    || FALLBACKS.date;
export const GIT_COMMIT = (BI && BI.commit)  || FALLBACKS.commit;
