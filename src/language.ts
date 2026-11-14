// Language of everything the guardian writes for people (risk reasons, SMS, summary):
// LANGUAGE=en for English, Lithuanian otherwise. The call itself is transcribed in TRANSCRIPTION_LANGUAGE.
export const ENGLISH = process.env.LANGUAGE === 'en';

/** The Lithuanian or the English text, by LANGUAGE. */
export const say = (lt: string, en: string) => (ENGLISH ? en : lt);
