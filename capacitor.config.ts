import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geosciences.tectostress',
  appName: 'Tectostress',
  webDir: 'dist',
  plugins: {
    Geolocation: {
      // Request high-accuracy GPS
    },
    Camera: {
      // Allow saving photos to gallery
    }
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
