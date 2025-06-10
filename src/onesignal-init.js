export function initializeOneSignal() {
  window.OneSignal = window.OneSignal || [];

  window.OneSignal.push(function () {
    if (window.OneSignal.__initAlreadyCalled) return;
    window.OneSignal.__initAlreadyCalled = true;

    console.log("✅ OneSignal.init() wird ausgeführt");

    window.OneSignal.init({
      appId: "68d015c9-7ca1-4dae-ba09-461af36314ae",
      safari_web_id: "web.onesignal.auto.2c2f7f93-c22c-4405-a44b-05589b796f38",
      notifyButton: { enable: true },
    });

    const anglerName = localStorage.getItem("anglerName");
    if (anglerName) {
      window.OneSignal.setExternalUserId(anglerName);
      console.log("📛 Angler gesetzt:", anglerName);
    }

    window.OneSignal.getUserId().then(id =>
      console.log("🟢 OneSignal User ID:", id)
    );
  });
}
