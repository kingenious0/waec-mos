import type { MetadataRoute } from 'next'

/**
 * Installable web app for iPhone and any phone that cannot install the APK.
 * Detection stays foreground-only here and the field screen says so plainly.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WAEC Field Operations',
    short_name: 'WAEC Field',
    description: 'Field verification and duty reporting for WAEC monitoring officers.',
    id: '/',
    start_url: '/field',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070913',
    theme_color: '#121422',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
