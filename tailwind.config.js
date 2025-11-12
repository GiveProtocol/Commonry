/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Light mode - Green and Orange
        green: {
          DEFAULT: 'var(--terminal-green)',
          dark: 'var(--terminal-green-dark)',
          glow: 'var(--terminal-green-glow)',
        },
        orange: {
          DEFAULT: 'var(--terminal-orange)',
          dark: 'var(--terminal-orange-dark)',
          glow: 'var(--terminal-orange-glow)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          darker: 'var(--paper-darker)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          light: 'var(--ink-light)',
        },
        // Dark mode - Cyan and Amber
        cyan: {
          DEFAULT: '#00d9ff',
          dark: '#0891b2',
          glow: 'rgba(0, 217, 255, 0.3)',
          'glow-strong': 'rgba(0, 217, 255, 0.6)',
        },
        amber: {
          DEFAULT: '#fbbf24',
          dark: '#f59e0b',
          glow: 'rgba(251, 191, 36, 0.3)',
        },
        dark: {
          DEFAULT: '#0d1117',
          lighter: '#161b22',
          border: '#30363d',
          surface: '#161b22',
        },
        text: {
          primary: '#c9d1d9',
          muted: '#8b949e',
        },
        parchment: {
          light: "#FDFCF7",
          DEFAULT: "#F5F3E8",
          dark: "#1A1612",
          darker: "#2C2416",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
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
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        scan: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        shimmer: {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
        blink: {
          '50%': { opacity: '0' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'scan': 'scan 8s linear infinite',
        'shimmer': 'shimmer 3s infinite',
        'blink': 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
}