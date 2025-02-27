import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NODE_ENV === 'production' ? 'https://vocalized.vercel.app' : 'http://localhost:3000'
  ),
  title: 'Vocalized | Interactive Audio Visualization Tool',
  description:
    'Visualize your voice and audio in real-time with customizable visualizations. A powerful tool for audio analysis and creative expression.',
  keywords: [
    'audio visualization',
    'voice visualization',
    'sound waves',
    'audio analysis',
    'real-time audio',
  ],
  authors: [{ name: 'Vocalized Team' }],
  openGraph: {
    title: 'Vocalized | Interactive Audio Visualization Tool',
    description: 'Visualize your voice and audio in real-time with customizable visualizations',
    url: 'https://vocalized.vercel.app',
    siteName: 'Vocalized',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Vocalized - Audio Visualization Tool',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vocalized | Interactive Audio Visualization Tool',
    description: 'Visualize your voice and audio in real-time with customizable visualizations',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
