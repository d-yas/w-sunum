// Tailwind v4 is wired through the `@tailwindcss/vite` plugin, so PostCSS needs
// no plugins here. This file exists to stop PostCSS's config lookup from walking
// up past the project root and picking up an unrelated (Tailwind v3) config.
export default { plugins: {} };
