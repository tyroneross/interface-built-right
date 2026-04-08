import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Interface Built Right',
  description: 'Design validation dashboard — verify UI matches intent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Sidebar />
        <main className="ml-[56px] min-h-screen">{children}</main>
      </body>
    </html>
  );
}
