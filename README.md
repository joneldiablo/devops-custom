# 🚀 DevOps Custom - Auto Update Daemon

Auto-update daemon para proyectos Node.js usando Git + PM2. Detecta cambios en repositorios y actualiza automáticamente cada 5 minutos (configurable).

## 📁 Estructura del Proyecto

```
devops-custom/
├── src/                          # TypeScript source code
│   ├── cli.ts                   # CLI entry point (yargs + env vars integration)
│   ├── index.ts                 # Main exports
│   ├── types.ts                 # Interfaces and types
│   │
│   ├── core/                    # Core business logic (STUB: ready for implementation)
│   │   ├── scanner.ts           # Find .git folders recursively, filter hidden
│   │   ├── poller.ts            # Poll every POLL_INTERVAL, check for changes
│   │   └── worker.ts            # Execute git pull, build, pm2 restart
│   │
│   ├── utils/                   # Utilities (STUB)
│   │   ├── logger.ts            # Pino logger (already implemented)
│   │   ├── git.ts               # Git command wrappers (simple-git)
│   │   ├── pm2.ts               # PM2 control
│   │   └── lock.ts              # Lock file system
│   │
│   └── cli/commands/            # CLI commands (STUB structure ready)
│       ├── start.ts             # Start the daemon
│       ├── scan.ts              # Scan for repos
│       └── status.ts            # Show daemon status
│
├── __tests__/                    # Test suite structure ready
│   ├── core/                    # Core logic tests
│   ├── utils/                   # Utility tests
│   └── integration/             # Integration tests
│
├── dist/                         # Compiled output (CJS + ESM)
│   ├── cjs/                     # CommonJS
│   ├── esm/                     # ES Modules
│   └── types/                   # TypeScript declarations
│
├── docs/                         # Generated TypeDoc documentation
├── tmp/                          # Temporary files (for testing, etc.)
│
├── .babelrc                      # Babel configuration
├── .gitignore                    # Git ignore rules
├── .npmignore                    # NPM publish rules
├── .env.example                  # Environment variables template
├── package.json                  # Project metadata and dependencies (VANILLA)
├── tsconfig.json                 # TypeScript config (CJS output)
├── tsconfig.esm.json             # TypeScript config (ESM output)
├── jest.config.ts                # Jest configuration
├── jest.config.e2e.ts            # E2E tests configuration
├── typedoc.json                  # TypeDoc configuration
├── exports.js                    # Dynamic exports generator
├── update-version.js             # Version bump script
├── release.sh                    # Release script for npm publishing
│
└── README.md                     # This file
```

## 🔧 Setup

### 1. Navigate to the project directory:
```bash
cd ~/devops-custom
```

### 2. Install dependencies:
```bash
yarn install
```

### 3. Create .env file:
```bash
cp .env.example .env
```

Edit `.env`:
```bash
POLL_INTERVAL=300000      # 5 minutes (or 10000 for testing = 10 seconds)
REPOS_ROOT=~/projects     # Path to scan for .git folders
LOG_LEVEL=info           # debug, info, warn, error
```

## 📝 Environment Variables + CLI Parameters

This project merges **environment variables** with **CLI parameters**. The pattern is:

1. **Environment Variables** (from `.env`) = defaults
2. **CLI Parameters** (from yargs) = override env vars

Example:
```bash
# Using env var
POLL_INTERVAL=10000 yarn dev start

# Using CLI flag (overrides env)
yarn dev start --poll-interval 20000

# Mix both
REPOS_ROOT=~/my-projects LOG_LEVEL=debug yarn dev start -p 15000
```

## 🎯 CLI Commands

### Start daemon
```bash
devops-custom start
devops-custom start --poll-interval 10000 --repos-root ~/my-repos
yarn dev start
```

### Scan for repositories
```bash
devops-custom scan
devops-custom scan --repos-root ~/my-repos
yarn dev scan
```

### Show daemon status
```bash
devops-custom status
yarn dev status
```

## 📦 Build & Publish

### Compile to dist/
```bash
yarn build         # Run tests + compile CJS + ESM + generate docs
yarn build:cjs     # Only compile CommonJS
yarn build:esm     # Only compile ES Modules
```

### Publish to npm
```bash
# Requires OTP (Two-Factor Authentication)
yarn release --otp 123456

# Manual steps:
yarn build
node update-version.js  # Bumps version in package.json
git add package.json
git commit -m "Release v0.x.x"
git tag v0.x.x
npm publish --otp=123456
git push --tags
```

## 🧪 Testing

```bash
yarn test                # Run all tests (unit + coverage)
yarn test:watch         # Run tests in watch mode
yarn test:e2e          # Run e2e tests
```

## 🔗 Architecture Overview

### Flow:
1. **CLI Entry** (`cli.ts`) - Parses env vars + CLI args with yargs
2. **Commands** (`cli/commands/`) - `start`, `scan`, `status`
3. **Core Logic** (`core/`) - Scanner → Poller → Worker
4. **Utilities** (`utils/`) - Git, PM2, Logger, Locks

### Key Features:
✅ **VANILLA** - No Redis, no BullMQ, no external queues
✅ **Sequential Updates** - `for` loop ensures one repo updates at a time
✅ **Filter Hidden Folders** - Automatically excludes `.cache`, `.git`, etc.
✅ **Env + CLI Integration** - Environment variables merge with CLI parameters
✅ **5-minute Polling** - Configurable via `POLL_INTERVAL` (in milliseconds)
✅ **Lock System** - Prevents simultaneous updates of same repo
✅ **PM2 Integration** - Automatic restart after build

## 📋 Implementation Checklist

### Phase 1: MVP (Core)
- [ ] Scanner implementation (find .git, filter hidden)
- [ ] Git utility wrappers (fetch, diff, pull)
- [ ] Worker implementation (locks, build, restart)
- [ ] Poller loop (sequential with `for` loop)
- [ ] CLI commands integration (start, scan, status)
- [ ] Logging setup and testing

### Phase 2: Optimization
- [ ] Lock system enhancements
- [ ] PM2 config detection
- [ ] `.devops-custom.json` per-repo config
- [ ] Better error handling and recovery
- [ ] Status reporting/daemon communication

### Phase 3: Polish
- [ ] Unit tests (jest)
- [ ] E2E tests
- [ ] Documentation (typedoc)
- [ ] Systemd service template
- [ ] npm publishing

## 🚀 Next Steps

1. ✅ **Structure created** (you're here!)
2. ⏭️ **Implement scanner** - Core.ts: Find repos, filter hidden folders
3. ⏭️ **Implement worker** - Execute git pull + build + pm2 restart
4. ⏭️ **Implement poller** - Periodic checks with sequential loop
5. ⏭️ **Connect CLI commands** - Integrate with implementation
6. ⏭️ **Testing & Documentation** - Jest + TypeDoc

## 💡 Key implementation details

### Scanner (detect hidden folders):
```typescript
const dirs = fs.readdirSync(REPOS_ROOT)
  .filter(dir => !dir.startsWith('.')); // ← Key filter
```

### Sequential updates (no parallel):
```typescript
for (const repo of repos) {
  await updateRepository(repo); // ← Blocks until complete
}
```

### Env + CLI merge:
```typescript
const config = {
  pollInterval: argv['poll-interval'] || process.env.POLL_INTERVAL,
  reposRoot: argv['repos-root'] || process.env.REPOS_ROOT,
};
```

## 📚 References
- [simple-git docs](https://github.com/steelbrain/simple-git)
- [yargs docs](https://yargs.js.org/)
- [pino logger](https://getpino.io/)
- [pm2 docs](https://pm2.keymetrics.io/)

---

**Ready to implement!** Start with the scanner in `src/core/scanner.ts`. Follow the TODOs in the codebase.
