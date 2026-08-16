# Drum sample attribution

The drum samples in this directory (`ride1`, `ride2`, `ridebell`,
`hihat-closed`, `hihat-pedal`, `sidestick`, `kick`) are General MIDI
percussion voices extracted from the **FluidR3 GM** SoundFont.

## Source chain

- Original SoundFont: **Fluid (R3)** by Frank Wen — released by its author
  under the MIT license.
- Distributed as Web Audio wavetables via
  [`surikov/webaudiofontdata`](https://github.com/surikov/webaudiofontdata),
  which is itself MIT licensed (Copyright (c) 2017 Srgy Surkv).
- Extracted here as plain `.mp3` files. No WebAudioFont *player* code is used
  or bundled — that separate project is GPL-3.0 and is deliberately not a
  dependency of this app.

## Required notices

```
Fluid (R3) SoundFont
Copyright (c) 2000-2002, 2008 Frank Wen <getfrank@gmail.com>

I hereby release Fluid under the MIT license, as described in COPYING.
```

```
MIT License
Copyright (c) 2017 Srgy Surkv

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Both licenses permit commercial redistribution, including in a paid App Store
application, provided the notices above ship with the app. They are surfaced
in-app under About → Credits.

## Guitar and bass samples

The sibling `guitar-electric/` and `bass-electric/` directories come from
[`nbrosowsky/tonejs-instruments`](https://github.com/nbrosowsky/tonejs-instruments).
