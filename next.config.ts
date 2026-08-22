import type { NextConfig } from "next";
import { MAX_PHOTO_SIZE_BYTES } from "./src/lib/completion-photos";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js defaults Server Action request bodies to 1MB, well under
      // MAX_PHOTO_SIZE_BYTES — a completion photo upload (which posts as a
      // multipart FormData body via a Server Action) got silently rejected
      // by the framework before reaching our own size check. Mobile camera
      // photos routinely land in the 2-5MB range, so this hit real users:
      // the rejected request threw inside uploadSquareCompletionPhoto with
      // no matching catch in the caller, leaving the upload spinner stuck
      // on forever. A little headroom above the photo limit covers the
      // multipart/form-data framing overhead.
      bodySizeLimit: MAX_PHOTO_SIZE_BYTES + 1024 * 1024,
    },
  },
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
