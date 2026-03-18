# devops-custom

Auto-update daemon for Git repositories with optional build and restart steps.

## Global Install Readiness

Current package status is compatible with global usage (`npm i -g devops-custom`):

- `bin` is defined in `package.json` as `devops-custom -> dist/cjs/cli.js`.
- Compiled artifacts are present under `dist/` and included in package tarball.
- CLI entrypoint includes Node shebang (`#!/usr/bin/env node`).

## Features Available Today

- Scans a root directory for Git repositories.
- Includes `reposRoot` itself if it has a `.git` folder.
- Sequential polling (no parallel repo updates).
- Fetch + incoming commit detection with `HEAD..remote/branch`.
- Pull, optional build, optional restart.
- Per-repo config via `.devops-custom.json`.
- Build-only command for one repository.

## Usage Modes

### 1) Use it globally (parameters)

Install globally:

```bash
npm i -g devops-custom
```

Run daemon using CLI parameters:

```bash
devops-custom start \
  --poll-interval 60000 \
  --repos-root /absolute/path/to/projects \
  --log-level info \
  --load-bashrc true \
  --bashrc-path ~/.bashrc
```

Other global commands:

```bash
devops-custom scan --repos-root /absolute/path/to/projects
devops-custom build --repo-path /absolute/path/to/repo
devops-custom status
```

### 2) Use it cloned (with `.env`)

Clone and run locally with `.env` defaults:

```bash
git clone <your-repo-url>
cd devops-custom
yarn install
cp .env.example .env
```

Example `.env`:

```env
POLL_INTERVAL=300000
REPOS_ROOT=~/projects
LOG_LEVEL=info
LOAD_BASHRC=true
BASHRC_PATH=~/.bashrc
```

Run from source:

```bash
yarn dev start
```

Optional local commands:

```bash
yarn dev scan
yarn dev build --repo-path ~/my-repo
yarn dev status
```

### 3) Use it as a dependency (parameters)

Install in another project:

```bash
npm i devops-custom
```

Start polling from your own code using explicit params:

```ts
import { Poller } from 'devops-custom';

async function main() {
  const poller = new Poller();

  await poller.start({
    pollInterval: 60_000,
    reposRoot: process.cwd(),
    logLevel: 'info',
    loadBashrc: true,
    bashrcPath: '~/.bashrc',
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Repository Config (`.devops-custom.json`)

Create this file inside each repository you want to control:

```json
{
  "branch": "master",
  "remote": "origin",
  "build": "yarn install && yarn build",
  "restart": "pm2 restart my-app",
  "pm2": true,
  "autoUpdate": true,
  "enabled": true
}
```

If the project does not use PM2:

```json
{
  "branch": "master",
  "remote": "origin",
  "build": "yarn install && yarn build",
  "pm2": false,
  "enabled": true,
  "autoUpdate": true
}
```

## Runtime Rules

- If configured remote does not exist, pull is skipped.
- If no pull happens, restart is skipped.
- If no build runs, restart is skipped.
- Runtime commands (`yarn`, `npm`, `pnpm`, `node`, `bun`, `deno`, etc.) are skipped for non Node/Deno/Bun repos.

## Exports

- `Poller`
- `Scanner`
- `Worker`
- Shared types from `src/types.ts`

## Development

```bash
yarn test
yarn build:cjs
yarn build:esm
yarn build
```

## AI Notice

Parts of the documentation and test code in this repository were generated with AI assistance and then reviewed and adjusted during development.
