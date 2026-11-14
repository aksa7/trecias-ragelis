import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import { bus } from './events';
import { startBrain } from './brain';
import { RECORDINGS_DIR, startRecorder } from './recorder';
import { registerEventStream } from './brain/eventStream';
import { registerTelephony } from './telephony';
import { openDevTunnel } from './telephony/tunnel';

const PORT = Number(process.env.PORT ?? 3000);

/** PUBLIC_HOST may be a bare host (abc.up.railway.app) or a full URL. */
function toPublicUrl(host: string): string {
  const url = host.startsWith('http') ? host : `https://${host}`;
  return url.replace(/\/$/, '');
}

async function main() {
  const app = Fastify();
  await app.register(formbody);
  await app.register(fastifyStatic, { root: path.join(__dirname, '..', 'public') });
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'dashboard'),
    prefix: '/dashboard/',
    decorateReply: false,
  });
  mkdirSync(RECORDINGS_DIR, { recursive: true });
  await app.register(fastifyStatic, { root: RECORDINGS_DIR, prefix: '/recordings/', decorateReply: false });

  // The main address opens the demo dashboard.
  app.get('/', (_req, reply) => reply.redirect('/dashboard/'));

  // Log every event so the console shows the whole call.
  bus.on((event) => console.log('[event]', JSON.stringify(event)));
  registerEventStream(app);
  startRecorder();
  startBrain();

  const telephony = await registerTelephony(app);
  await app.listen({ port: PORT, host: '0.0.0.0' });

  const onPublicUrl = async (url: string) => {
    await telephony.setPublicUrl(url);
    console.log('\nServer ready.');
    console.log(`  Victim page:  ${url}/phone/victim.html  (open first, press "Go online")`);
    console.log(`  Scammer page: ${url}/phone/scammer.html`);
    console.log(`  Dashboard:    ${url}/dashboard/   (demo without calls: ${url}/dashboard/?demo)`);
  };

  // Deployed: PUBLIC_HOST (or Railway's own domain) is the stable address. Local: open a temporary tunnel.
  const publicHost = process.env.PUBLIC_HOST || process.env.RAILWAY_PUBLIC_DOMAIN;
  if (publicHost) await onPublicUrl(toPublicUrl(publicHost));
  else if (process.env.RAILWAY_ENVIRONMENT) {
    // No tunnel on a server: it would need ssh, and would take the calls away from the real deployment.
    console.error('[server] No public address: generate a domain in Railway (Settings → Networking). Calls are off.');
  } else openDevTunnel(PORT, (url) => void onPublicUrl(url));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
