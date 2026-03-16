# 🚀 Diablito Deploy Daemon - Auto Update de Proyectos

## 📋 La Idea
Crear un daemon en TypeScript que automáticamente actualice proyectos cuando detecte cambios en sus repositorios Git. Sistema **local-first**, sin webhooks ni APIs de GitHub. Solo Git + PM2 + Node.

---

## 🎯 Resumen de la Estrategia

| Aspecto | Decisión |
|--------|----------|
| **Polling vs Webhooks** | Polling (sin config en GitHub) ✅ |
| **Frecuencia** | 5 minutos (configurable, variable de entorno) |
| **Detección de cambios** | `git fetch` + `git rev-list` (no diff manual) |
| **Updates** | Secuenciales con loop simple (uno a la vez) |
| **Complejidad** | Baja - cero configuración externa |
| **Stack** | VANILLA (sin Redis, BullMQ, ni dependencias extra) |

---

## 📝 Pasos Necesarios (Mejor Estimación)

### **Fase 1: MVP (Semana 1)**
- [x] Estructura base del proyecto (basada en `adba`) ✅ COMPLETADO
- [x] Configuración de variables de entorno (POLL_INTERVAL, REPOS_ROOT) ✅ COMPLETADO
- [ ] Scanner de repos (detectar `.git` cada 24h, filtrar carpetas ocultas) ⏭️ NEXT
- [ ] Poller (check cada POLL_INTERVAL, configurable via env) ⏭️ NEXT
- [ ] Worker simple (git pull + build + pm2 restart, async/await secuencial) ⏭️ NEXT
- [ ] CLI básico (`start`, `scan`, `status`) ⏭️ NEXT

### **Fase 2: Optimizaciones (Semana 2)**
- [ ] Sistema de locks (`.deploying`) para evitar deploys simultáneos
- [ ] Detección automática de config desde `ecosystem.config.js`
- [ ] Archivo `.diablito-deploy.json` por proyecto
- [ ] Logging + métricas básicas
- [ ] Usar repositorio Git si existe para publicar en npm

### **Fase 3: Polish (Semana 3)**
- [ ] Tests unitarios
- [ ] Documentación (README, ejemplos)
- [ ] Publicar en npm (si aplica)
- [ ] Systemd service para autostart

---

## 🏗️ Arquitectura Recomendada (Basada en `adba`)

```
diablito-deploy/
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── start.ts      (inicia daemon)
│   │   │   ├── scan.ts       (escanea repos manualmente)
│   │   │   └── status.ts     (muestra estado)
│   │   └── index.ts
│   │
│   ├── core/
│   │   ├── scanner.ts        (find .git folders, skip hidden)
│   │   ├── poller.ts         (check changes cada POLL_INTERVAL)
│   │   ├── worker.ts         (git pull + build + restart, loop secuencial)
│   │   └── types.ts          (interfaces)
│   │
│   ├── utils/
│   │   ├── git.ts            (wrappers git commands)
│   │   ├── pm2.ts            (control pm2)
│   │   ├── logger.ts         (logging)
│   │   └── lock.ts           (lock system)
│   │
│   ├── index.ts              (entry point daemon)
│   └── cli.ts                (entry point CLI)
│
├── __tests__/
│   ├── core/
│   ├── utils/
│   └── integration/
│
├── .env.example              (POLL_INTERVAL=300000, REPOS_ROOT=~/projects)
├── .env                      (git ignored)
├── .babelrc                  (babel config, copia de adba)
├── .git/                     (repositorio git)
├── .gitignore                (copia de adba, + .env, dist/)
├── .npmignore                (copia de adba)
├── .diablito-deploy.json     (config default)
├── README.md
├── package.json              (vanilla, sin Redis/BullMQ)
├── tsconfig.json             (copia de adba, rootDir: src)
├── tsconfig.esm.json         (copia de adba)
├── jest.config.ts            (copia de adba)
├── typedoc.json              (copia de adba)
└── yarn.lock
```

---

## 💡 Cambios Clave (Ajustes Solicitados)

### ✅ **VANILLA - Sin Redis ni BullMQ**
- Mantener arquitectura simple y auto-contenida
- Updates secuenciales con loop simple (no Promise.all, no paralelo)
- Sin dependencias externas de queue

### ✅ **Variables de Entorno**
```bash
# .env
POLL_INTERVAL=300000        # 5 minutos (ms), configurable para testing
REPOS_ROOT=~/projects       # Carpeta raíz para buscar repos
LOG_LEVEL=info              # debug, info, warn, error
```

### ✅ **Scanner Inteligente**
- Buscar `.git` recursivamente en REPOS_ROOT
- **FILTRAR carpetas ocultas** (comienzan con `.`)
- Sacar remote origin de cada repo
- Guardar en memoria al boot

### ✅ **Updates Secuenciales**
```typescript
// ✅ HACER (secuencial, uno a uno)
for (const repo of repos) {
  await updateRepository(repo);
  // Cada repo termina antes de pasar al siguiente
  // Garantiza NO hay builds simultáneos
}
```

### ✅ **Basado en estructura de `adba`**
- Copiar: .babelrc, tsconfig.json, jest.config.ts, typedoc.json
- NO copiar: node_modules, src/, __tests__/, dist/
- Adaptar package.json para diablito-deploy (vanilla)

### ✅ **Usar Git si existe**
- Si hay `.git/` en el directorio, usarlo para publicar en npm

---

## 🎮 Flujo de Ejecución (Recomendado)

```
START daemon
  │
  ├─ LOAD ENV VARS
  │  ├─ POLL_INTERVAL (default: 300000ms = 5 min)
  │  ├─ REPOS_ROOT (default: ~/projects)
  │  └─ LOG_LEVEL
  │
  ├─ SCAN $REPOS_ROOT (al boot + cada 24h)
  │  ├─ Buscar todas las carpetas .git
  │  ├─ FILTRAR carpetas ocultas (comienzan con ".")
  │  ├─ Extraer remote origin
  │  └─ Guardar en memory (repos[])
  │
  ├─ INIT POLLER (cada POLL_INTERVAL ms)
  │  │
  │  └─ FOR EACH repo in repos[] (SECUENCIAL)
  │     ├─ git fetch --all --prune
  │     ├─ git rev-list HEAD...origin/master --count
  │     │
  │     ├─ IF changes > 0
  │     │  ├─ Adquirir lock (.deploying)
  │     │  ├─ git pull
  │     │  ├─ yarn build (o npm run build)
  │     │  ├─ pm2 restart <app-name>
  │     │  ├─ Liberar lock
  │     │  └─ LOG success + timestamp
  │     │
  │     └─ LOG estado + timestamp
  │
  └─ HEALTH CHECK
     └─ Escribir estado a archivo/socket
```

**Garantía**: Loop secuencial asegura que cada actualización se complete ANTES de pasar a la siguiente. Nunca habrá builds simultáneos.

---

## 📊 Comparación de Alternativas

| Método | CPU | Latency | Setup | Ideal para |
|--------|-----|---------|-------|-----------|
| **Webhooks** | Muy baja | Instant | Requiere config GitHub | Producción |
| **GitHub API** | Baja | Instant | Token requerido | CI/CD |
| **Polling Git** ✅ | Muy baja | 5 min | Cero config | Tu caso |

---

## 🛠️ Stack Recomendado (VANILLA)

```typescript
// Core
- TypeScript 5+
- Node.js 18+

// CLI
- Yargs (similar a adba)

// Git & PM2
- simple-git (wrapper Git)
- pm2 (ya tienes instalado)

// Utilities
- Pino o Winston (logging, como adba)
- Dotenv (config desde .env)

// Testing (Fase 3)
- Jest (como adba)
- ts-jest
```

**NO incluir**: Redis, BullMQ, RabbitMQ, ninguna cola externa
- Mantener simple y auto-contenido
- Loop secuencial garantiza no hay race conditions

---

## 🎯 MVP - Features Mínimas

```typescript
✅ Scanner de proyectos (filtra ocultos)
✅ Poller cada POLL_INTERVAL (5 min por défault)
✅ git pull + build automático
✅ PM2 restart automático
✅ Sistema de locks
✅ CLI (start/scan/status)
✅ Logging básico
✅ Variables de entorno para config

❌ Queue worker (add en Fase 2)
❌ Web dashboard (add en Fase 2)
❌ Notificaciones (add en Fase 2)
```

---

## 📈 Estimación de Esfuerzo

| Fase | Duración | Prioridad | Notas |
|------|----------|-----------|-------|
| **Fase 1 (MVP)** | 5-7 días | CRÍTICA | Lo más importante |
| **Fase 2 (Optimización)** | 3-5 días | MEDIA | Si necesitas escalabilidad |
| **Fase 3 (Polish)** | 2-3 días | BAJA | Para producción / npm |

---

## 🚨 Cosas Importantes (Detalle Ninja)

### 1. **FILTRAR carpetas ocultas (MUY IMPORTANTE)**
```typescript
// ❌ NO HACER - incluye ocultas
const dirs = fs.readdirSync(REPOS_ROOT);

// ✅ HACER - excluye .cache, .config, .git, etc.
const dirs = fs.readdirSync(REPOS_ROOT)
  .filter(dir => !dir.startsWith('.'));
```

### 2. **git fetch con --all --prune**
```bash
git fetch --all --prune
# Limpia ramas eliminadas, evita fantasmas
```

### 3. **Loop SECUENCIAL (no paralelo)**
```typescript
// ❌ NO HACER (paralelo)
repos.forEach(async (repo) => await update(repo));

// ✅ HACER (secuencial)
for (const repo of repos) {
  await updateRepository(repo);
}
```

### 4. **Evitar deploys simultáneos**
```typescript
const lockFile = path.join(repoPath, '.deploying');
if (fs.existsSync(lockFile)) {
  return; // Skip si ya despliega
}
```

### 5. **Detectar cambios eficientemente**
```typescript
const count = await git.revList(['HEAD...origin/master', '--count']);
if (parseInt(count) > 0) {
  // Hay cambios
}
```

### 6. **Usar variables de entorno**
```typescript
import 'dotenv/config';

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '300000');
const REPOS_ROOT = process.env.REPOS_ROOT || path.expandUser('~/projects');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
```

### 7. **Config por proyecto**
```json
// .diablito-deploy.json
{
  "branch": "main",
  "build": "yarn build",
  "restart": "pm2 restart api",
  "autoUpdate": true,
  "enabled": true
}
```

---

## 📦 Estructura del Proyecto (Basada en `adba`)

### Archivos a Copiar de `adba`
```
De: ~/dev/adba                    → A: /home/diablo/dev/devops-custom

✅ .babelrc
✅ .gitignore                     (+ .env, + dist/)
✅ .npmignore
✅ tsconfig.json                  (rootDir: ./src)
✅ tsconfig.esm.json
✅ jest.config.ts
✅ typedoc.json
✅ package.json                   (adaptado: sin ADBA, solo diablito-deploy)
✅ yarn.lock (si usas yarn)

❌ node_modules/
❌ __tests__/                     (haremos test propios)
❌ src/                           (haremos src propios)
❌ dist/
❌ coverage/
```

### package.json Adaptado (MVP)
```json
{
  "name": "diablito-deploy",
  "version": "0.1.0",
  "description": "Auto-update daemon para proyectos Node con Git + PM2",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/types/index.d.ts",
  "bin": {
    "diablito-deploy": "dist/cjs/cli.js"
  },
  "scripts": {
    "build:cjs": "tsc -p tsconfig.json",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build": "yarn test && rm -rf dist/* && yarn build:cjs && yarn build:esm",
    "dev": "ts-node src/cli.ts",
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "simple-git": "^3.x.x",
    "pm2": "^5.x.x",
    "yargs": "^17.x.x",
    "pino": "^8.x.x",
    "dotenv": "^16.x.x"
  },
  "devDependencies": {
    "@types/node": "^20.x.x",
    "typescript": "^5.x.x",
    "jest": "^29.x.x",
    "ts-jest": "^29.x.x",
    "@types/jest": "^29.x.x",
    "ts-node": "^10.x.x"
  }
}
```

### .env.example
```bash
# Polling interval en millisegundos (default: 5 minutos)
POLL_INTERVAL=300000

# Carpeta raíz donde buscar repos (default: ~/projects)
REPOS_ROOT=~/projects

# Nivel de log: debug, info, warn, error
LOG_LEVEL=info

# Para testing: cambiar interval a 10 segundos
# POLL_INTERVAL=10000
```

---

## 🚀 Estructura de Comandos CLI

```bash
# Iniciar daemon
diablito-deploy start

# Escanear repos manualmente
diablito-deploy scan

# Ver estado actual
diablito-deploy status

# En desarrollo
yarn dev start      # dev mode
yarn build          # compilar a dist/
yarn test           # tests
```

---

## ✨ Conclusión

**Recomendación final**: 
- ✅ Empieza con el MVP (Fase 1) directamente
- ✅ Git polling + PM2 es todo lo que necesitas (VANILLA)
- ✅ Loop secuencial = garantía de no hay builds simultáneos
- ✅ Variables de entorno para configuración flexible
- ✅ Ninguna configuración externa en GitHub
- ✅ Escalable después si necesitas

**Timeline realista**: 1-2 semanas para MVP funcional.

---

## 🔗 Próximos Pasos

1. [ ] Crear estructura del proyecto (basada en adba)
2. [ ] Copiar archivos de config de adba
3. [ ] Implementar scanner de repos
4. [ ] Implementar poller + worker
5. [ ] Crear CLI (start/scan/status)
6. [ ] Primera versión funcional
7. [ ] Testing + documentación
