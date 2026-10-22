## Description

<!-- What does this PR change and why? Link the issue it resolves, if any. -->

## Checklist

Before submitting, confirm all of the following (see [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md)):

- [ ] Changes are minimal and relevant to a single issue
- [ ] Commits squashed to a single commit, rebased off latest `master`, no conflicts
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Code follows existing conventions (`'use strict'`, no whitespace reformatting)
- [ ] Version fields were **not** touched (release PRs only: `.homeycompose/app.json`, `package.json`, `package-lock.json`, `.homeychangelog.json`)

## If this PR adds or changes a device type

- [ ] Device registered in `hdl/hdl_devicelist.js` with channel count, main capability, and excluded capabilities
- [ ] Driver type added to `this._driverlist` in `app.js`
- [ ] `.homeycompose/` files updated (edit those, not root `app.json`)
- [ ] Tests added or updated in `test/` (extend `test/mocks/homey.js` if more SDK mocking is needed)
