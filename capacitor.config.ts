/**
 * Capacitor configuration for TITAN Android/iOS APK builds.
 * Keeps WebView on HTTPS scheme (https://localhost) so requests to
 * https://titan.luluapp.com/api/* never trigger Mixed Content blocks.
 */
const config = {
  appId: 'com.antonlalo.titan',
  appName: 'TITAN',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    hostname: 'localhost',
    allowNavigation: ['titan.luluapp.com', '*.luluapp.com'],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
