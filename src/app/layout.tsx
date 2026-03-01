import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'HotelMol Dashboard',
  description: 'Hotel management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1C2230',
              color: '#F1F5F9',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              fontSize: '14px',
              fontFamily: 'var(--font-dm-sans)',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#0D1117' },
            },
            error: {
              iconTheme: { primary: '#F43F5E', secondary: '#0D1117' },
            },
          }}
        />
      </body>
    </html>
  );
}
