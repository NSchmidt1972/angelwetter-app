// KEIN import mehr nötig — OneSignal wird global über das Script in index.html geladen

export async function initOneSignal() {
  window.OneSignalDeferred = window.OneSignalDeferred || [];

  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: "b05a44e8-bea5-4941-8972-5194254aadad",
        safari_web_id: "web.onesignal.auto.12398f86-c304-472b-bd93-39635fc69310",
        notifyButton: {
          enable: true,
        },
      });

      console.log('✅ OneSignal initialisiert');

      const userId = await OneSignal.getUserId();
      console.log('OneSignal User ID:', userId);
      resolve(userId);
    });
  });
}

