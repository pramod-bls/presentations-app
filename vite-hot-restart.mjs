// Forge's bundled main-process hot-restart is stubbed out upstream
// (electron/forge#3380), so the main process never auto-restarts on
// rebuild. This plugin emits `rs\n` into the Forge CLI's stdin after
// each successful dev build, which Forge reads as "restart main".
export function hotRestartMain(label) {
  let firstBuild = true;
  return {
    name: 'forge-hot-restart-' + label,
    closeBundle() {
      if (firstBuild) { firstBuild = false; return; }
      if (process.env.NODE_ENV !== 'development') return;
      try {
        process.stdin.emit('data', 'rs\n');
      } catch {
        // stdin may not be writable in some environments
      }
    },
  };
}
