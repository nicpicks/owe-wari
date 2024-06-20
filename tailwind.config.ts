import { type Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
    content: ['./src/**/*.tsx'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-geist-sans)', ...fontFamily.sans],
            },
            textColor: {
                DEFAULT: '#000',
            },
            backgroundColor: {
                DEFAULT: '#FFF',
            },
        },
    },
    plugins: [require('daisyui')],
    daisyui: {
        themes: [
            {
                mytheme: {
                    primary: '#9796f0',
                    'primary-darker': '#7c7ad6',
                    secondary: '#00be3e',
                    accent: '#5d00ff',
                    neutral: '#00070c',
                    'base-100': '#fffbf5',
                    info: '#00beff',
                    success: '#00d25d',
                    warning: '#ff9700',
                    error: '#ff164d',
                },
            },
        ],
    },
} satisfies Config
