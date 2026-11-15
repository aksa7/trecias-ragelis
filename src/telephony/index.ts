// Telephony: a simulated phone line. Two browser "phones" (scammer, victim) call each other
// through Twilio. No real phone numbers are dialled, so the call works on any Twilio account.
// Twilio transcribes both sides live (Deepgram) and we turn that into transcript events.
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import twilio from 'twilio';
import { bus } from '../events';
import { ensureApiKey, ensureTwimlApp } from './twilioSetup';
import { TRANSCRIPTION_HINTS } from './hints';
import { startActions } from './actions';
import { ensureMessagingService } from './sms';
import { registerTextLine } from './textLine';

type Role = 'scammer' | 'victim';
type TwilioBody = Record<string, string>;

const ROLES: Role[] = ['scammer', 'victim'];
// /voice runs on the scammer's leg: inbound = what the scammer says, outbound = what they hear.
const SPEAKER: Record<string, Role> = { inbound_track: 'scammer', outbound_track: 'victim' };
const room = (callSid: string) => `room-${callSid}`;

export async function registerTelephony(app: FastifyInstance) {
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken } = process.env;
  if (!accountSid || !authToken) throw new Error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env');
  const language = process.env.TRANSCRIPTION_LANGUAGE ?? 'lt';

  const client = twilio(accountSid, authToken);
  const apiKey = await ensureApiKey(client);
  const messagingServiceSid = await ensureMessagingService(client).catch((err) => {
    console.error('[sms] Messaging setup failed, SMS disabled:', err instanceof Error ? err.message : err);
    return null;
  });
  startActions(client, messagingServiceSid);
  registerTextLine(app);
  let publicUrl = '';
  let appSid = '';

  // Twilio's browser SDK, served to the phone pages.
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', '..', 'node_modules', '@twilio', 'voice-sdk', 'dist'),
    prefix: '/sdk/',
    decorateReply: false,
  });

  // Access pass for a phone page, plus TURN relays so audio gets through strict Wi-Fi.
  app.get<{ Querystring: { role?: string } }>('/token', async (req, reply) => {
    const role = req.query.role as Role;
    if (!ROLES.includes(role)) return reply.code(400).send({ error: 'role must be scammer or victim' });
    if (!appSid) return reply.code(503).send({ error: 'server is still starting' });

    const token = new twilio.jwt.AccessToken(accountSid, apiKey.sid, apiKey.secret, { identity: role, ttl: 3600 });
    token.addGrant(new twilio.jwt.AccessToken.VoiceGrant({ outgoingApplicationSid: appSid, incomingAllow: true }));
    const { iceServers } = await client.tokens.create({ ttl: 3600 });
    return { token: token.toJwt(), iceServers };
  });

  // The scammer page started a call: transcribe both sides, then ring the victim page.
  app.post<{ Body: TwilioBody }>('/voice', async (req, reply) => {
    const { CallSid, From } = req.body;
    bus.emit({ type: 'call_started', room: room(CallSid), from: From });

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.start().transcription({
      statusCallbackUrl: `${publicUrl}/transcription`,
      track: 'both_tracks',
      inboundTrackLabel: 'scammer',
      outboundTrackLabel: 'victim',
      transcriptionEngine: 'deepgram',
      speechModel: 'nova-3',
      languageCode: language,
      hints: TRANSCRIPTION_HINTS,
    });
    twiml.dial().client('victim');
    return reply.type('text/xml').send(twiml.toString());
  });

  // Live transcription events from Twilio. Only finished utterances become transcript events.
  app.post<{ Body: TwilioBody }>('/transcription', async (req, reply) => {
    const { CallSid, TranscriptionEvent, Track, Final, TranscriptionData } = req.body;
    if (process.env.DEBUG_TRANSCRIPTION && TranscriptionEvent === 'transcription-content') {
      console.log(`(debug ${Track} final=${Final}) ${TranscriptionData}`);
    }
    if (TranscriptionEvent === 'transcription-content' && Final === 'true') {
      const text = JSON.parse(TranscriptionData).transcript?.trim();
      if (text) bus.emit({ type: 'transcript', room: room(CallSid), role: SPEAKER[Track], text });
    } else if (TranscriptionEvent === 'transcription-error') {
      console.error(`Transcription error ${req.body.TranscriptionErrorCode}: ${req.body.TranscriptionError}`);
    } else if (TranscriptionEvent !== 'transcription-content') {
      console.log(`(${TranscriptionEvent} ${req.body.TranscriptionEngine ?? ''} ${req.body.LanguageCode ?? ''})`);
    }
    return reply.code(204).send();
  });

  // Twilio reports here when the call ends.
  app.post<{ Body: TwilioBody }>('/call-status', async (req, reply) => {
    if (req.body.CallStatus === 'completed') bus.emit({ type: 'call_ended', room: room(req.body.CallSid) });
    return reply.code(204).send();
  });

  return {
    /** Call when the public address is known (or changes): Twilio's webhooks must point there. */
    async setPublicUrl(url: string) {
      publicUrl = url;
      appSid = await ensureTwimlApp(client, url);
    },
  };
}
