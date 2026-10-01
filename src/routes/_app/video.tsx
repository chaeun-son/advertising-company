import { createFileRoute } from "@tanstack/react-router";
import { VideoEditor } from "@/components/video/video-editor";

export const Route = createFileRoute("/_app/video")({
  component: VideoPage,
});

function VideoPage() {
  return (
    <div className="h-full min-h-0">
      <VideoEditor />
    </div>
  );
}
