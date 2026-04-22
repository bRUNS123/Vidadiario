import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Diario AG',
  description: 'Tu registro personal de vida',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        {/* Prevent theme flash: reads localStorage before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('diario-theme');document.documentElement.classList.toggle('dark',t!=='light');})();`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
