import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KLIKS | Foundation',
  description: 'KLIKS development foundation. Payment flows are not enabled.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
