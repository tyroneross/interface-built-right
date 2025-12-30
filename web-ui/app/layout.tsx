import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Interface Built Right - Visual Comparison',
  description: 'Visual regression testing comparison viewer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-medium text-gray-900">
                Interface Built Right
              </h1>
              <nav className="flex gap-6">
                <a
                  href="/"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sessions
                </a>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
