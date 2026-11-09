import type { Metadata } from "next";

import { SpotifyView } from "@/components/spotify-view";

export const metadata: Metadata = {
  title: "Spotify · Academic Autopilot",
  description: "Conecta tu Spotify y escucha tus playlists mientras estudias.",
};

export default function SpotifyPage() {
  return <SpotifyView />;
}
