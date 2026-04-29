import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.echolql.dreamweaver',
  appName: 'DreamWeaver',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: '/Users/echoli/.openclaw/workspace/DreamWeaver/android/app/dream-upload-key.keystore', // Full path to your file
      keystorePassword: 'Disneyisa33',
      keystoreAlias: 'dream-weaver',
      keystoreAliasPassword: 'Disneyisa33',
      releaseType: 'AAB', // Use 'AAB' for Play Store or 'APK' for direct install
    }
  }
};

export default config;
