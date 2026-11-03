import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitor.peladapro',
  appName: 'PeladaPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
