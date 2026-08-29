/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Palette SpeedSante+ (fournie par M. Faustin). "forest" reste le
        // nom du token (pour ne pas casser des centaines de classes deja
        // ecrites dans le code), mais porte desormais les valeurs NEUTRES
        // du catalogue (texte/bordures) - c'est son usage majoritaire
        // reel (texte secondaire, bordures de cartes, titres), verifie
        // avant ce changement plutot que suppose. "primary" est un
        // NOUVEAU token, introduit specifiquement pour la vraie couleur
        // de marque (teal) sur les boutons et surfaces de marque.
        forest: {
          50: "#F1F5F9",
          100: "#E2E8F0",
          300: "#94A3B8",
          500: "#64748B",  // Texte secondaire (catalogue)
          700: "#334155",
          900: "#0F172A",  // Texte principal (catalogue)
        },
        primary: {
          50: "#E6F5F3",
          100: "#CCEBE7",
          300: "#5FA89E",
          500: "#14958A",
          700: "#0F766E",  // Primaire / Teal (catalogue)
          900: "#0B5850",
        },
        secondary: {
          500: "#2563EB",  // Secondaire / Bleu (catalogue)
          600: "#1D4ED8",
        },
        success: {
          50: "#F0FDF4",
          500: "#22C55E",  // Succes / Vert (catalogue)
          700: "#15803D",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",  // Accent / Orange (catalogue)
          600: "#D97706",
        },
        clay: {
          500: "#DC2626",  // Danger/erreur - non fourni dans le catalogue fourni, rouge standard retenu
          600: "#B91C1C",
        },
        paper: "#F8FAFC",  // Fond (catalogue)
        ink: "#0F172A",    // Texte principal (catalogue)
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
}
