type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallSnapshot = {
  canPrompt: boolean;
  installed: boolean;
};

const listeners = new Set<() => void>();
let deferred: BeforeInstallPromptEvent | null = null;
let hooked = false;
let snapshot: InstallSnapshot = { canPrompt: false, installed: false };

function readInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standalone || ios;
}

function refresh() {
  const next: InstallSnapshot = { canPrompt: Boolean(deferred), installed: readInstalled() };
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) {
    snapshot = next;
  }
}

function emit() {
  refresh();
  for (const fn of listeners) fn();
}

function hook() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  refresh();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export function getInstallSnapshot(): InstallSnapshot {
  hook();
  refresh();
  return snapshot;
}

export function subscribeInstall(onStoreChange: () => void) {
  hook();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  hook();
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
