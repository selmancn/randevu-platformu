import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Randevu Platformu',
    short_name: 'Randevu',
    lang: 'tr',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5ed',
    theme_color: '#173b31',
    icons: [
      { src: '/randevu-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/randevu-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
