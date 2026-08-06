import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bingoal",
    short_name: "Bingoal",
    description:
      "Build fun, funky bingo cards for your goals and events. Check things off, count things up, and chase that BINGO.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff9f0",
    theme_color: "#e60053",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
