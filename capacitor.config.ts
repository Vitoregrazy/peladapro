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
      // Desativa o cloud pago da Capgo; usamos nosso próprio servidor OTA gratuito via Vercel
      autoUpdate: false,
      resetWhenUpdate: false,
    },
  },
};

export default config;
