#!/usr/bin/env python3
"""
Generate ear training audio clips via Google Cloud Text-to-Speech.

Setup (one time):
  1. Go to console.cloud.google.com
  2. Enable the Cloud Text-to-Speech API
  3. Create an API key: APIs & Services → Credentials → Create Credentials → API key
  4. (Optional) Restrict the key to "Cloud Text-to-Speech API" for safety

Usage:
  python3 generate-audio.py YOUR_API_KEY

Output:
  25 MP3 files saved to audio/ directory (created if missing).
  Commit the audio/ directory to the repo.

Voice options (change VOICE below):
  en-US-Neural2-F   — clear, professional (recommended)
  en-US-Neural2-D   — male version
  en-US-Journey-F   — newest, most natural (may require billing enabled beyond free tier)
  en-US-Wavenet-F   — slightly older but also good
"""

import sys, json, base64, os, urllib.request, urllib.error

VOICE = 'en-US-Neural2-F'
SPEAKING_RATE = 0.85   # slightly slower than normal speech
PITCH = -2.0           # slightly lower; sounds more authoritative

PHRASES = [
    # Intervals
    'Minor second', 'Major second', 'Minor third', 'Major third',
    'Perfect fourth', 'Tritone', 'Perfect fifth', 'Minor sixth',
    'Major sixth', 'Minor seventh', 'Major seventh', 'Octave',
    # Triads
    'Major triad', 'Minor triad', 'Augmented triad', 'Diminished triad',
    # 7th chords
    'Major seven', 'Minor seven', 'Dominant seven', 'Half diminished',
    # Cadences
    'Two five', 'Five one', 'Two five one', 'One six', 'Four minor one',
]

def to_filename(phrase):
    return phrase.lower().replace(' ', '-') + '.mp3'

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    api_key = sys.argv[1]
    url = f'https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}'
    os.makedirs('audio', exist_ok=True)

    ok = 0
    for phrase in PHRASES:
        payload = json.dumps({
            'input': {'text': phrase},
            'voice': {'languageCode': 'en-US', 'name': VOICE},
            'audioConfig': {
                'audioEncoding': 'MP3',
                'speakingRate': SPEAKING_RATE,
                'pitch': PITCH,
            }
        }).encode()
        req = urllib.request.Request(url, data=payload,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
                audio = base64.b64decode(data['audioContent'])
                path = os.path.join('audio', to_filename(phrase))
                with open(path, 'wb') as f:
                    f.write(audio)
                print(f'  ✓  {phrase}  →  {path}')
                ok += 1
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f'  ✗  {phrase}: HTTP {e.code} — {body[:120]}')
        except Exception as e:
            print(f'  ✗  {phrase}: {e}')

    print(f'\n{ok}/{len(PHRASES)} clips saved to audio/')
    if ok == len(PHRASES):
        print('\nNext steps:')
        print('  git add audio/ && git commit -m "Add Google TTS audio clips"')
        print('  git push')

if __name__ == '__main__':
    main()
