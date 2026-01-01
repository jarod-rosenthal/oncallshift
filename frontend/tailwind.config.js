/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Atlassian-inspired palette
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Neutral grays (Atlassian style)
        neutral: {
          50: "hsl(var(--neutral-50))",
          100: "hsl(var(--neutral-100))",
          200: "hsl(var(--neutral-200))",
          300: "hsl(var(--neutral-300))",
          400: "hsl(var(--neutral-400))",
          500: "hsl(var(--neutral-500))",
          600: "hsl(var(--neutral-600))",
          700: "hsl(var(--neutral-700))",
          900: "hsl(var(--neutral-900))",
        },
        // Accent blues
        blue: {
          50: "hsl(var(--blue-50))",
          100: "hsl(var(--blue-100))",
          600: "hsl(var(--blue-600))",
        },
        // Accent purple
        purple: {
          50: "hsl(var(--purple-50))",
          100: "hsl(var(--purple-100))",
        },
        // Status colors
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(0 0% 100%)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(0 0% 100%)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(0 0% 100%)",
        },
        // Semantic aliases (shadcn/ui compatibility)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Custom spacing
      spacing: {
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
        '128': '32rem',   // 512px
      },
      // Atlassian typography scale
      fontSize: {
        'display-2xl': ['64px', { lineHeight: '72px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-2xl': ['40px', { lineHeight: '48px', fontWeight: '600' }],
        'heading-xl': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'heading-lg': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'heading-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'body-xs': ['12px', { lineHeight: '16px' }],
      },
      // Atlassian-style shadows (softer, more professional)
      boxShadow: {
        'sm': '0 1px 2px rgba(9, 30, 66, 0.08)',
        'md': '0 4px 8px rgba(9, 30, 66, 0.12)',
        'lg': '0 8px 12px rgba(9, 30, 66, 0.15)',
        'xl': '0 12px 24px rgba(9, 30, 66, 0.18)',
      },
      // Border radius
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      // Container max-widths
      maxWidth: {
        'container-sm': '640px',
        'container-md': '768px',
        'container-lg': '1024px',
        'container-xl': '1280px',
      },
    },
  },
  plugins: [],
}
