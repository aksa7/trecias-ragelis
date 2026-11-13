// SMS to the family, sent from a name ("BustedAI") instead of a phone number.
// Lithuania accepts name senders without registration; the Twilio Messaging Service that
// holds the name is created automatically on first start.
import type { Twilio } from 'twilio';

const SERVICE_NAME = 'bustedai-alerts';
const SENDER_NAME = 'BustedAI'; // max 11 letters/digits

export interface Contact {
  name: string;
  phone: string;
}

/** FAMILY_CONTACTS="Dukra:+3706...,Sūnus:+3706..." (falls back to EMERGENCY_CONTACT_NUMBER). */
export function familyContacts(): Contact[] {
  const list = process.env.FAMILY_CONTACTS ?? '';
  const contacts = list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, phone] = entry.includes(':') ? entry.split(':') : ['Artimasis', entry];
      return { name: name.trim(), phone: phone.trim() };
    });
  if (contacts.length === 0 && process.env.EMERGENCY_CONTACT_NUMBER) {
    contacts.push({ name: 'Artimasis', phone: process.env.EMERGENCY_CONTACT_NUMBER });
  }
  return contacts;
}

/** Messaging Service with the "BustedAI" name sender. Returns its SID. */
export async function ensureMessagingService(client: Twilio): Promise<string> {
  const services = await client.messaging.v1.services.list({ limit: 50 });
  let service = services.find((s) => s.friendlyName === SERVICE_NAME);
  if (!service) {
    service = await client.messaging.v1.services.create({ friendlyName: SERVICE_NAME });
    console.log(`Created Twilio Messaging Service ${service.sid}`);
  }
  const senders = await client.messaging.v1.services(service.sid).alphaSenders.list({ limit: 5 });
  if (!senders.some((s) => s.alphaSender === SENDER_NAME)) {
    await client.messaging.v1.services(service.sid).alphaSenders.create({ alphaSender: SENDER_NAME });
    console.log(`Added SMS sender name "${SENDER_NAME}"`);
  }
  return service.sid;
}

/** Sends one text to every family contact. Failures are logged per contact, never thrown. */
export async function textFamily(client: Twilio, messagingServiceSid: string, body: string): Promise<Contact[]> {
  const sent: Contact[] = [];
  for (const contact of familyContacts()) {
    try {
      await client.messages.create({ messagingServiceSid, to: contact.phone, body });
      sent.push(contact);
      console.log(`[sms] → ${contact.name} ${contact.phone}`);
    } catch (err) {
      console.error(`[sms] Failed to text ${contact.name} ${contact.phone}:`, err instanceof Error ? err.message : err);
    }
  }
  return sent;
}
