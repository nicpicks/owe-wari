import '~/styles/globals.css'

import { IBM_Plex_Mono } from 'next/font/google'
import { TRPCReactProvider } from '~/trpc/react'
import ThemeToggle from '~/app/_components/theme-toggle'
import { NetworkStatusBanner } from './_components/network-status-banner'

// Shippori Mincho B1 and Zen Kaku Gothic New are loaded via a <link> below
// instead of next/font/google: next/font only exposes their latin/latin-ext
// subsets, which excludes the Japanese glyphs (割, 昼, 夜, …) this theme
// relies on. The Google Fonts CSS2 endpoint serves the full unicode-range
// set so the kanji actually render instead of falling back to tofu boxes.
const plexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-mono',
    display: 'swap',
})

export const metadata = {
    title: 'owe-wari — split expenses, zero drama',
    description: 'Track group expenses and settle up without the awkwardness.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent' as const,
        title: 'owe-wari',
    },
    icons: [
        { rel: 'icon', url: '/favicon.ico?v=2' },
        { rel: 'apple-touch-icon', url: '/icons/apple-touch-icon-v2.png' },
    ],
}

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover' as const,
    themeColor: '#FFAE1F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            className={plexMono.variable}
        >
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap"
                    rel="stylesheet"
                />
                {/* Prevent flash of wrong theme on load */}
                <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t)})()` }} />
            </head>
            <body style={{ fontFamily: 'var(--font-ui), sans-serif' }}>
                <NetworkStatusBanner />
                <TRPCReactProvider>{children}</TRPCReactProvider>
                <ThemeToggle />
            </body>
        </html>
    )
}
