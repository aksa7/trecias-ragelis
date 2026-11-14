# Demo voice-over (ElevenLabs)

The same call that the dashboard plays in `?demo` mode (`dashboard/demo.js`), in English for the pitch. It goes
through all three levels: **All good → Suspicious (family gets an SMS) → Scammer (call is cut)**.

Generate it in ElevenLabs, then put the audio over the screen recording (or save it as `dashboard/demo.mp3`
and the timings in `demo.js` can be synced to the real audio).

**How to generate:** ElevenLabs → *Text to Dialogue* (model **Eleven v3**), two voices:

| Speaker | Voice                                                     |
|---------|-----------------------------------------------------------|
| CALLER  | Man, 35–45, calm, polite, "professional", not villainous   |
| GRANDMA | Elderly woman, 70+, warm, a bit slow, gets nervous        |

Length is about 46 s. The words in [brackets] are v3 audio tags (they set the tone and are not spoken).

## Script to paste (with tone tags)

```
CALLER: [calm, professional] Good afternoon, this is John from your bank's security department.
GRANDMA: [surprised] Oh, hello. Is something wrong?
CALLER: [serious] We've noticed an unusual payment of two thousand four hundred euros leaving your account.
GRANDMA: [scared] Oh dear... I didn't send any money!
CALLER: [reassuring, then urgent] Don't worry, we'll stop it. But we have to act quickly, before the money is gone.
GRANDMA: [nervous] All right... what do I need to do?
CALLER: [calm] We'll move your savings to a safe account. [lowers voice] And please, don't tell anyone about this, not even your family.
GRANDMA: [hesitant] Not even my daughter? She always helps me with the bank...
CALLER: [firm] No, this is a confidential investigation. You've just received a Smart I D code. Read it to me.
GRANDMA: [flustered] Wait a moment, let me—
```

End the audio with a short hang-up tone right after her "let me—". GETBUSTED cuts the call the moment the caller
asks for the code, so grandma never gets to read it out.

The dashboard numbers are what the real brain (keywords + Claude + rules) produced for these exact lines at
this pace: 25 → 37 → 60 **Suspicious** → 85 **Scammer**, cut → 95.

## What the dashboard shows at each line

| # | Line | Dashboard |
|---|------|-----------|
| 1 | CALLER: Good afternoon, this is John from your bank's security department. | **All good**, risk 25 |
| 2 | GRANDMA: Oh, hello. Is something wrong? | |
| 3 | CALLER: We've noticed an unusual payment of 2,400 euros leaving your account. | |
| 4 | GRANDMA: Oh dear... I didn't send any money! | |
| 5 | CALLER: Don't worry, we'll stop it. But we have to act quickly, before the money is gone. | risk 37 |
| 6 | GRANDMA: All right... what do I need to do? | |
| 7 | CALLER: We'll move your savings to a safe account. And please, don't tell anyone… | risk 60, **Suspicious**, banner "SMS sent to family" |
| 8 | GRANDMA: Not even my daughter? She always helps me with the bank... | |
| 9 | CALLER: No, this is a confidential investigation. You've just received a Smart-ID code. Read it to me. | risk 85, **Scammer**, crimson banner "Call cut" |
| 10 | GRANDMA: Wait a moment, let me— *(hang-up tone)* | risk 95, second SMS, summary |
