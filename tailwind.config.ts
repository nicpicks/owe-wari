import { type Config } from 'tailwindcss'

export default {
    content: ['./src/**/*.tsx'],
    theme: {
        extend: {
            fontFamily: {
                display: ['var(--font-cormorant)', 'Georgia', 'serif'],
                ui:      ['var(--font-jakarta)', 'sans-serif'],
                mono:    ['var(--font-mono)', 'monospace'],
            },
            colors: {
                ink:        'var(--ink)',
                surface:    'var(--surface)',
                'surface-2':'var(--surface-2)',
                'surface-3':'var(--surface-3)',
                border:     'var(--border)',
                'border-2': 'var(--border-2)',
                muted:      'var(--muted)',
                dim:        'var(--dim)',
                body:       'var(--body)',
                heading:    'var(--heading)',
                amber:      'var(--amber)',
                'amt-green':'var(--green)',
                'amt-red':  'var(--red)',
            },
        },
    },
    plugins: [],
} satisfies Config
