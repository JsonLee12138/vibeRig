import { defineConfig, presetIcons, presetWind3, transformerVariantGroup } from "unocss";

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      scale: 1.1,
      warn: true,
    }),
  ],
  transformers: [
    transformerVariantGroup(),
  ],
  theme: {
    colors: {
      ink: "#1d1d1f",
      muted: "#67686a",
      canvas: "#fcf8fb",
      panel: "#ffffff",
      line: "#e4e2e4",
      primary: "#0066cc",
      danger: "#ba1a1a",
    },
  },
  shortcuts: {
    "vr-panel": "border border-line bg-white shadow-[0_18px_48px_rgba(29,29,31,0.08)]",
    "vr-button": "inline-flex items-center justify-center gap-2 rounded-2 border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-primary/40",
    "vr-button-primary": "inline-flex items-center justify-center gap-2 rounded-2 border border-primary bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#005cba]",
    "vr-kicker": "text-xs font-semibold uppercase tracking-[0.08em] text-muted",
  },
});
