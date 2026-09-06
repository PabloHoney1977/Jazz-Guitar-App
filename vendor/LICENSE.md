# Third-party runtime libraries

These files are vendored **on purpose** — they are not build output and must
stay committed. Loading them from a CDN made the app unable to boot without an
internet connection (React undefined → `app.js` threw on its first line → empty
`#root` → black screen). See `index.html`.

## React / ReactDOM 18.2.0

- `react.production.min.js`
- `react-dom.production.min.js`

Copyright (c) Meta Platforms, Inc. and affiliates.
Licensed under the **MIT License**. The full license text is retained in the
`@license` header at the top of each file.

Source: the official `react@18.2.0` / `react-dom@18.2.0` npm packages
(`umd/*.production.min.js`), byte-identical to the previously used
`cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/...` builds.

### Upgrading

    npm install react@18.2.0 react-dom@18.2.0 --no-save --prefix /tmp/react-umd
    cp /tmp/react-umd/node_modules/react/umd/react.production.min.js vendor/
    cp /tmp/react-umd/node_modules/react-dom/umd/react-dom.production.min.js vendor/

Keep the version in `sw.js` (`CACHE`) bumped when these change.
