import defaultTheme from 'tailwindcss/defaultTheme';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Semantic color tokens for the paper-and-ink interface.
      colors: {
        primary: {
          50: '#eef4fa',
          100: '#d9e6f4',
          200: '#b8d0ea',
          500: '#2f5d8c',
          600: '#254b71',
          700: '#1a3550'
        },
        surface: {
          50: '#fffdf8',
          100: '#fbf6ec',
          200: '#f2e9d8',
          300: '#e6d8bc'
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#dbe3ec',
          300: '#c2ceda',
          500: '#66758a',
          700: '#334155',
          900: '#172033'
        },
        accent: {
          50: '#ecf8f4',
          100: '#d2efe7',
          500: '#3f907d',
          600: '#2e6f60'
        },
        error: {
          50: '#fff1f1',
          100: '#ffdede',
          500: '#d64545',
          600: '#b83232'
        }
      },
      // Inter is the primary UI font; handwriting previews stay on widely
      // available cursive/system fallbacks until custom handwriting fonts load.
      fontFamily: {
        ui: ['Inter', ...defaultTheme.fontFamily.sans],
        handwriting: ['"Segoe Print"', '"Bradley Hand"', '"Comic Sans MS"', 'cursive']
      },
      // Tailwind already uses a 4px base scale; these extra steps preserve it.
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem'
      },
      borderRadius: {
        card: '1rem',
        panel: '1.5rem'
      },
      boxShadow: {
        paper: '0 10px 30px -18px rgba(23, 32, 51, 0.35)',
        'paper-lg': '0 18px 45px -24px rgba(23, 32, 51, 0.4)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
      }
    }
  },
  plugins: []
};

export default config;
