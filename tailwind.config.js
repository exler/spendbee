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
                    DEFAULT: "#2C2D30",
                    50: "#5A5B60",
                    100: "#4A4B50",
                    200: "#3A3B40",
                    300: "#2C2D30",
                    400: "#232427",
                    500: "#1A1B1E",
                    600: "#131416",
                    700: "#0D0E10",
                    800: "#07080A",
                    900: "#000000",
                },
            },
        },
    },
    plugins: [],
};
