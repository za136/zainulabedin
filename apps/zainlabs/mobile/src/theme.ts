// Same tokens as the website (web/app/globals.css), from the Canva templates.
export const colors = {
  ink: "#0e0e0f",
  ink2: "#1a1a1c",
  paper: "#f4f2ee",
  paper2: "#e9e6e0",
  card: "#ffffff",
  line: "#d9d5cd",
  muted: "#8b8a86",
  accent: "#d7261e",
};

export const font = {
  mono: "Courier", // replaced by the platform monospace on Android/web
};

export const statusColor = (status: string) =>
  status === "MVP" ? colors.accent : status === "Live" || status === "Released" ? colors.ink : status === "In development" ? colors.accent : colors.muted;
