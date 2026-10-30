import type { Metadata } from 'next';
import '@fontsource-variable/space-grotesk';
import './workspace.css';

export const metadata: Metadata = {
  title: 'KLIKS | Pay the person',
  description: 'A simpler way to pay people, built around the bank you already use.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
