import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omax.controlcenter',
  appName: 'Omax Control Center',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
