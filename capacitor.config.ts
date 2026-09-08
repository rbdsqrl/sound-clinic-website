import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.simplehearing.app',
  appName: 'Simple Hearing',
  webDir: 'dist',
  // WKWebView does not inset its content for the notch/status bar or home indicator by
  // default (Capacitor's own default is `never`) — without this, fixed-position content
  // (like the landing page header) renders underneath the iOS status bar.
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
