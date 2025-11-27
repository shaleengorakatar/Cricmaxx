import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.52476e1bde244133afcfe617a3922efc',
  appName: 'shariz-predict-trade',
  webDir: 'dist',
  server: {
    url: 'https://52476e1b-de24-4133-afcf-e617a3922efc.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false
    }
  }
};

export default config;
