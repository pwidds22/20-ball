import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "20 Ball",
    short_name: "20 Ball",
    description: "Two-man team golf: keep 20 scores, hide them, don't blow up.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe2",
    theme_color: "#0b5d33",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
