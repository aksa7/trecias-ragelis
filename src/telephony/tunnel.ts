// Local development only: a free public HTTPS address so Twilio can reach this laptop.
// Pinggy runs over SSH on port 443, which works on the venue Wi-Fi (Cloudflare's tunnel is blocked there).
// Free tunnels drop and expire after 60 min, so we reopen it and report each new address.
import { spawn } from 'node:child_process';

export function openDevTunnel(port: number, onUrl: (url: string) => void) {
  const proc = spawn('ssh', [
    '-p', '443', '-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=15',
    '-o', 'ExitOnForwardFailure=yes', '-R', `0:localhost:${port}`, 'free.pinggy.io',
  ]);
  let reported = false;
  const onData = (buf: Buffer) => {
    const match = buf.toString().match(/https:\/\/[a-z0-9-]+\.run\.pinggy-free\.link/);
    if (match && !reported) {
      reported = true;
      onUrl(match[0]);
    }
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  // Without ssh there is no tunnel; keep the server up (dashboard and ?demo still work).
  proc.on('error', (err) => console.error('[tunnel] Could not start ssh:', err.message));
  proc.on('exit', () => {
    console.log('\nTunnel closed, reopening…');
    setTimeout(() => openDevTunnel(port, onUrl), 2000);
  });
  process.on('exit', () => proc.kill());
}
