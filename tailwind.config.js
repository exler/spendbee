/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{html,js,svelte,ts}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#FFC700",
                    50: "#FFF9E0",
                    100: "#FFF3CC",
                    200: "#FFE699",
                    300: "#FFD966",
                    400: "#FFCC33",
                    500: "#FFC700",
                    600: "#CC9F00",
                    700: "#997700",
                    800: "#665000",
                    900: "#332800",
                },
                dark: {
                    DEFAULT: "#1A1A1A",
                    50: "#4D4D4D",
                    100: "#404040",
                    200: "#333333",
                    300: "#262626",
                    400: "#1A1A1A",
                    500: "#0D0D0D",
                    600: "#000000",
                },
            },
        },
    },
    plugins: [],
};
