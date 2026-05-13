import '~/styles/globals.css'

import { Cormorant_Garamond, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { TRPCReactProvider } from '~/trpc/react'

const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    style: ['normal', 'italic'],
    variable: '--font-cormorant',
    display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-jakarta',
    display: 'swap',
})

const jetbrains = JetBrains_Mono({
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
        { rel: 'icon', url: '/favicon.ico' },
        { rel: 'apple-touch-icon', url: '/icons/apple-touch-icon.png' },
    ],
}

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover' as const,
    themeColor: '#F2A007',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            className={`${cormorant.variable} ${jakarta.variable} ${jetbrains.variable}`}
        >
            <body style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                <TRPCReactProvider>{children}</TRPCReactProvider>
            </body>
        </html>
    )
}
