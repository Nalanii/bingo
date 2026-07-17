import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allows Firebase Auth's signInWithPopup to poll the popup window's
        // closed state across origins; the default same-origin COOP value
        // blocks that check and logs (harmless but noisy) console warnings.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
