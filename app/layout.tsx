import type { Metadata, Viewport } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Randevu Platformu',
  description: 'Yerel işletmeler için hizmet ve fiyat tarifesi.',
  appleWebApp: { capable: true, title: 'Randevu' },
};
export const viewport: Viewport = { themeColor: '#173b31' };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
