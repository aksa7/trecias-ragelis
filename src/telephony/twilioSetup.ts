// One-time Twilio resources the browser phones need. Created automatically, so a fresh
// account works without clicking around in the Twilio console.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Twilio } from 'twilio';

const KEY_FILE = '.twilio-key.json';
const APP_NAME = 'bustedai-phone';

export interface ApiKey {
  sid: string;
  secret: string;
}

/**
 * API key that signs the phone pages' access tokens.
 * Deployed: set TWILIO_API_KEY + TWILIO_API_SECRET. Local: created once and saved to .twilio-key.json.
 */
export async function ensureApiKey(client: Twilio): Promise<ApiKey> {
  const { TWILIO_API_KEY, TWILIO_API_SECRET } = process.env;
  if (TWILIO_API_KEY && TWILIO_API_SECRET) return { sid: TWILIO_API_KEY, secret: TWILIO_API_SECRET };
  if (existsSync(KEY_FILE)) return JSON.parse(readFileSync(KEY_FILE, 'utf8'));

  const key = await client.newKeys.create({ friendlyName: 'bustedai-phone' });
  const saved = { sid: key.sid, secret: key.secret };
  writeFileSync(KEY_FILE, JSON.stringify(saved, null, 2));
  console.log(`Created Twilio API key ${key.sid} (saved to ${KEY_FILE})`);
  return saved;
}

/** TwiML App: where Twilio asks for instructions when a phone page starts a call. */
export async function ensureTwimlApp(client: Twilio, publicUrl: string): Promise<string> {
  const settings = {
    voiceUrl: `${publicUrl}/voice`,
    voiceMethod: 'POST',
    statusCallback: `${publicUrl}/call-status`,
    statusCallbackMethod: 'POST',
  };
  const [existing] = await client.applications.list({ friendlyName: APP_NAME, limit: 1 });
  if (existing) {
    await client.applications(existing.sid).update(settings);
    return existing.sid;
  }
  const app = await client.applications.create({ friendlyName: APP_NAME, ...settings });
  console.log(`Created Twilio TwiML App ${app.sid}`);
  return app.sid;
}
