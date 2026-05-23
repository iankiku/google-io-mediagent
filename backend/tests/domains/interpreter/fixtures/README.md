# Interpreter test fixtures

Drop short audio clips here for manual end-to-end testing. Suggested set:

- `mandarin_patient_short.webm` — 3-5 seconds of Mandarin: e.g. "我最近头很痛，已经两天了" (My head has been hurting for two days)
- `hindi_patient_short.webm` — 3-5 seconds of Hindi: e.g. "मुझे दो दिन से सिर में दर्द है" (I've had a headache for two days)
- `english_doctor_short.webm` — 3-5 seconds of clinical English: e.g. "Let's get a CBC and a BMP today, follow up next week"

Generation options:
1. Record yourself or a teammate via QuickTime → export as `.m4a`, rename `.webm`-ish if needed (the CLI infers MIME from extension).
2. Use Gemini TTS (any Google text-to-speech) to synthesize from the suggested transcripts.
3. Use the browser's MediaRecorder on `/interpreter` and grab the blob from the network tab.

Then run:

    python -m app.domains.interpreter.cli \
        --audio backend/tests/domains/interpreter/fixtures/mandarin_patient_short.webm \
        --role patient \
        --user-id 11111111-1111-1111-1111-111111111111
