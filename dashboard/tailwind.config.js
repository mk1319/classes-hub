/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design tokens map to CSS variables (see styles/globals.css) so dark mode
      // falls out of the token set — plan/08-design-guidelines.md "Slate & Amber".
      colors: {
        ink: 'hsl(var(--ink))',
        muted: 'hsl(var(--muted))',
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        primary: { DEFAULT: 'hsl(var(--primary))', fg: 'hsl(var(--primary-fg))' },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        destructive: 'hsl(var(--destructive))',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
      },
    },
  },
  plugins: [],
};
