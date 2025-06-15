let initialized = false;

export function initOneSignal() {
  if (initialized) {
    console.log("✅ OneSignal bereits initialisiert");
    return;
  }

  // Typischer Hack für reines JavaScript:
  const w = window;
  w.OneSignal = w.OneSignal || [];

  w.OneSignal.push(function() {
    w.OneSignal.init({
      appId: "b05a44e8-bea5-4941-8972-5194254aadad",
      safari_web_id: "web.onesignal.auto.12398f86-c304-472b-bd93-39635fc69310",
      notifyButton: { enable: true }
    });

    console.log("✅ OneSignal init abgeschlossen");
    initialized = true;
  });
}
