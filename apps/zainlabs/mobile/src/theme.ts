// Same tokens as the website (web/app/globals.css), from the Canva templates.
export const colors = {
  ink: "#0e0e0f",
  ink2: "#1a1a1c",
  paper: "#f4f2ee",
  paper2: "#e9e6e0",
  card: "#ffffff",
  line: "#d9d5cd",
  muted: "#6f6e69", // secondary text on light
  mutedOnDark: "#8b8a86", // secondary text on ink
  accent: "#d4241d", // fills, buttons, red text on light
  accentOnDark: "#ff4d42", // small red text on ink
};

export const font = {
  mono: "Courier", // replaced by the platform monospace on Android/web
};

export const statusColor = (status: string) =>
  status === "MVP" ? colors.accent : status === "Live" || status === "Released" ? colors.ink : status === "In development" ? colors.accent : colors.muted;
