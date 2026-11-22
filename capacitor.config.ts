import type { CapacitorConfig } from '@capacitor/cli'

// The APK is a native wrapper around the deployed web app. All business logic,
// authentication and data stay on the server; native code only adds capabilities
// a browser cannot provide (background location, mock-location and integrity signals).
// Override with CAPACITOR_SERVER_URL for staging builds.
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://waec-mos-prd.vercel.app'

const config: CapacitorConfig = {
  appId: 'org.waec.mos.field',
  appName: 'WAEC Field',
  webDir: 'public',
  server: {
    url: serverUrl,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    FieldLocation: {
      notificationTitle: 'WAEC field tracking',
      notificationText: 'Recording your location while you are on duty.',
      intervalMs: 10000,
    },
  },
}

export default config
