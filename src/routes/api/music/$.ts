import { createFileRoute } from "@tanstack/react-router";
import { handleMusicRequest } from "@/lib/video/music-http.server";

export const Route = createFileRoute("/api/music/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleMusicRequest(request),
      POST: ({ request }) => handleMusicRequest(request),
      PATCH: ({ request }) => handleMusicRequest(request),
      DELETE: ({ request }) => handleMusicRequest(request),
    },
  },
});
