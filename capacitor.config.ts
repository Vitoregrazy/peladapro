import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitor.peladapro',
  appName: 'PeladaPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    CapacitorUpdater: {
      // Desativa o cloud pago da Capgo; usamos nosso próprio canal OTA via GitHub/Vercel
      autoUpdate: false,
      // Garante que instalar um APK nativo mais novo substitua bundles OTA antigos
      resetWhenUpdate: true,
      appReadyTimeout: 15000,
      responseTimeout: 30,
    },
  },
};

export default config;
