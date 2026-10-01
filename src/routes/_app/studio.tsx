import { createFileRoute } from "@tanstack/react-router";
import { StudioApp } from "@/components/studio/studio-app";
import "@/studio.css";

export const Route = createFileRoute("/_app/studio")({
  component: StudioPage,
});

function StudioPage() {
  return (
    <div className="adsmile-studio h-full min-h-0">
      <StudioApp />
    </div>
  );
}
