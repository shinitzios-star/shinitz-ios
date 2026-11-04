/**
 * Expo config plugin for react-native-razorpay@2.2.3
 *
 * Razorpay's bundled AndroidManifest.xml is missing android:exported on
 * its CheckoutActivity and RzpTokenReceiver, which Android 12+ requires
 * whenever an intent-filter is present. This plugin injects the
 * overrides via tools:replace at prebuild time so the merger fixes them.
 *
 * Also appends Razorpay ProGuard keep-rules so R8 doesn't strip the SDK
 * in release builds.
 *
 * Wire it up in app.json under "plugins":
 *   "./plugins/withRazorpay"
 */

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── AndroidManifest.xml patch ────────────────────────────────────────────────

function withRazorpayManifest(config) {
  return withAndroidManifest(config, async (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application[0];

    if (!app.activity) app.activity = [];
    if (!app.receiver) app.receiver = [];

    // Razorpay CheckoutActivity — must be exported on Android 12+
    if (!app.activity.some((a) => a.$['android:name'] === 'com.razorpay.CheckoutActivity')) {
      app.activity.push({
        $: {
          'android:name': 'com.razorpay.CheckoutActivity',
          'android:configChanges': 'keyboard|keyboardHidden|orientation|screenSize',
          'android:exported': 'true',
          'tools:replace': 'android:exported',
        },
      });
    }

    // Razorpay token receiver — broadcasts from device SDK
    if (!app.receiver.some((r) => r.$['android:name'] === 'com.razorpay.RzpTokenReceiver')) {
      app.receiver.push({
        $: {
          'android:name': 'com.razorpay.RzpTokenReceiver',
          'android:exported': 'true',
          'tools:replace': 'android:exported',
        },
      });
    }

    return cfg;
  });
}

// ─── ProGuard rules ───────────────────────────────────────────────────────────

const RAZORPAY_PROGUARD = `
# Razorpay — keep SDK classes from R8 obfuscation in release builds
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/*
-keepclasseswithmembers class * {
  public void onPayment*(...);
}
`;

function withRazorpayProGuard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8');
        if (!existing.includes('com.razorpay.')) {
          fs.writeFileSync(proguardPath, existing + '\n' + RAZORPAY_PROGUARD);
        }
      }
      return cfg;
    },
  ]);
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = function withRazorpay(config) {
  config = withRazorpayManifest(config);
  config = withRazorpayProGuard(config);
  return config;
};
