/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'hunter-orange': '#ff6b35',
                'stone-dark': '#1c1917', // stone-900
                'go-gold': '#FBBF24', // Amber-400
            },
            fontFamily: {
                sans: ['"Nunito Sans"', 'sans-serif'],
                display: ['"Concert One"', 'cursive'],
            },
            animation: {
                'ken-burns': 'ken-burns 20s ease-out infinite alternate',
                'fade-in': 'fade-in 1s ease-out forwards',
                'shine': 'shine 1.5s ease-in-out',
            },
            keyframes: {
                'ken-burns': {
                    '0%': { transform: 'scale(1) translate(0, 0)' },
                    '100%': { transform: 'scale(1.1) translate(-1%, -1%)' },
                },
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'shine': {
                    '0%': { left: '-100%' },
                    '100%': { left: '100%' },
                }
            }
        },
    },
    plugins: [],
}
