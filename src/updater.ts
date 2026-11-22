import { isTauri } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// Not enabled until a trusted signing public key and HTTPS release endpoint are configured.
// Private signing keys must live only in the release pipeline secrets.
export const updatesEnabled = isTauri() && import.meta.env.VITE_RASAVIN_UPDATER === 'enabled';

export type AvailableUpdate = NonNullable<Awaited<ReturnType<typeof check>>>;

export async function findUpdate(): Promise<AvailableUpdate | null> {
  if (!updatesEnabled) return null;
  return await check();
}

export async function installUpdate(update: AvailableUpdate, progress: (percent: number | null) => void): Promise<void> {
  let received = 0;
  let total = 0;
  await update.downloadAndInstall(event => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0;
      received = 0;
      progress(total ? 0 : null);
    } else if (event.event === 'Progress') {
      received += event.data.chunkLength;
      progress(total ? Math.min(100, Math.round(received * 100 / total)) : null);
    } else if (event.event === 'Finished') progress(100);
  });
  await relaunch();
}
