/**
 * Used only after `npx cap add android`. The web build does not load this file.
 * See docs/CAPACITOR_NOTIFICATIONS.md.
 */
const config = {
  appId: 'com.lalo.titan',
  appName: 'TITAN',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#F59E0B',
    },
  },
};

export default config;
