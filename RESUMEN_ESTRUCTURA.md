# 📋 Resumen Ejecutivo - DevOps Custom

> Documento completo sobre la estructura, funcionamiento, ventajas y cómo usar el proyecto

---

## 🎯 ¿QUÉ HACE EL PROYECTO?

**DevOps Custom** es un **daemon (proceso de fondo)** que:

1. **Escanea** carpetas en busca de repositorios Git (`.git`)
2. **Verifica cambios** cada 5 minutos (configurable)
3. **Ejecuta automáticamente** si hay cambios:
   - `git pull` (trae cambios)
   - `yarn build` (compila)
   - `pm2 restart <app>` (reinicia la app)
4. **Genera logs** detallados de cada operación

### Caso de Uso
Tienes 3 proyectos Node en `~/projects/`:
```
~/projects/
├── mi-api/                    ← Push a main
├── mi-web/                    ← Push a main
└── mi-worker/                 ← Push a main
```

**Sin DevOps Custom:** Tienes que ir a cada carpeta y actualizar manualmente.

**Con DevOps Custom:** Cada 5 minutos, automáticamente:
- ✅ `mi-api` detecta cambios → pull → build → restart
- ✅ `mi-web` detecta cambios → pull → build → restart
- ✅ `mi-worker` detecta cambios → pull → build → restart

---

## 🏗️ ESTRUCTURA INICIAL - VISUAL

```
devops-custom/
│
├── 📁 src/                          ← Código TypeScript (LO QUE IMPLEMENTARÁS)
│   │
│   ├── cli.ts                       ✅ CLI principal (yargs + env vars)
│   ├── index.ts                     ✅ Exporta todo
│   ├── types.ts                     ✅ Define interfaces (TypeScript)
│   │
│   ├── 📁 core/                     ← LÓGICA PRINCIPAL
│   │   ├── scanner.ts               📝 1. Encuentra repos (.git)
│   │   ├── poller.ts                📝 2. Verifica cambios cada 5 min
│   │   └── worker.ts                📝 3. Ejecuta git pull, build, restart
│   │
│   ├── 📁 utils/                    ← HERRAMIENTAS
│   │   ├── logger.ts                ✅ Logs (Pino - ya listo)
│   │   ├── git.ts                   📝 Wrappers de git
│   │   ├── pm2.ts                   📝 Control de PM2
│   │   └── lock.ts                  📝 Sistema de bloqueos
│   │
│   └── 📁 cli/commands/             ← COMANDOS
│       ├── start.ts                 📝 Inicia daemon
│       ├── scan.ts                  📝 Escanea repos
│       └── status.ts                📝 Ver estado
│
├── 🧪 __tests__/                    ← PRUEBAS
│   ├── core/scanner.test.ts         📝 Tests de scanner
│   ├── utils/logger.test.ts         📝 Tests de logger
│   └── integration/                 📝 Tests E2E
│
├── 🔧 Configuración (LISTA)
│   ├── .env.example                 ✅ Variables de entorno
│   ├── package.json                 ✅ Dependencias (VANILLA: sin Redis)
│   ├── tsconfig.json                ✅ TypeScript → JavaScript
│   ├── jest.config.ts               ✅ Configuración tests
│   ├── .gitignore, .npmignore       ✅ Git rules
│   └── [otros...]
│
├── 🚀 Build & Release (LISTA)
│   ├── exports.js                   ✅ Generador de exports
│   ├── release.sh                   ✅ Script para publicar a npm
│   └── update-version.js            ✅ Bump de versión
│
└── 📚 Documentación
    ├── README.md                    ✅ Setup
    ├── STRUCTURE.md                 ✅ Detalle
    └── todo.md                      ✅ Estrategia
```

### ¿Qué está listo (✅) vs Qué debes implementar (📝)?

| Archivo | Estado | Por qué |
|---------|--------|--------|
| `types.ts` | ✅ Listo | Interfaces definidas |
| `logger.ts` | ✅ Listo | Pino configurado |
| `cli.ts` | ✅ Estructura | Framework de yargs, falta conectar comandos |
| `scanner.ts` | 📝 TODO | Debes buscar `.git` |
| `poller.ts` | 📝 TODO | Debes hacer el loop |
| `worker.ts` | 📝 TODO | Debes ejecutar pull/build/restart |
| `git.ts` | 📝 TODO | Debes usar `simple-git` |
| `pm2.ts` | 📝 TODO | Debes usar pkg `pm2` |
| `lock.ts` | 📝 TODO | Debes crear/validar `.deploying` |

---

## 🔄 ¿CÓMO FUNCIONA? - FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│ Usuario ejecuta: yarn dev start --poll-interval 10000           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. CLI (cli.ts)                                                  │
│    • Carga .env (POLL_INTERVAL=300000, REPOS_ROOT=~/projects)   │
│    • Parsea argumentos con yargs                                │
│    • CLI override env (10000 > 300000)                          │
│    • Crea config: pollInterval=10000, reposRoot=~/projects     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SCANNER (scanner.ts) - Ejecuta UNA SOLA VEZ                 │
│    • Busca recursivamente en ~/projects                         │
│    • Filtra carpetas ocultas (.git, .cache, etc.)              │
│    • Extrae URL del remoto de cada repo                        │
│    • Lee .devops-custom.json si existe                       │
│    • Retorna: [                                                 │
│        { path: '~/projects/api', name: 'api', },               │
│        { path: '~/projects/web', name: 'web', },               │
│      ]                                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. POLLER (poller.ts) - Loop Infinito                           │
│                                                                  │
│    setInterval(10000ms) {  ← Cada 10 segundos:                 │
│      for (repo of repos) {                                      │
│        ✓ git fetch                                              │
│        ✓ git rev-list (¿hay cambios?)                          │
│        if (cambios detectados) {                               │
│          ✓ Llama a WORKER                                      │
│        }                                                        │
│      }                                                          │
│    }                                                            │
│                                                                  │
│    ⚠️ IMPORTANTE: Loop SECUENCIAL (no paralelo)                │
│    Espera a que termine API antes de revisar Web              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. WORKER (worker.ts) - Ejecuta la actualización               │
│    (Solo si hay cambios)                                        │
│                                                                  │
│    ✓ Adquiere LOCK (.deploying)                                │
│    ✓ Ejecuta: git pull                                         │
│    ✓ Ejecuta: yarn build                                       │
│    ✓ Ejecuta: pm2 restart api                                  │
│    ✓ Libera LOCK                                               │
│    ✓ Retorna UpdateResult { success, message, timestamp }      │
│                                                                  │
│    ⚠️ Si falla en cualquier punto, registra error y continúa  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. LOGGER (logger.ts) - Registra TODO                           │
│    [INFO] 11:23:45 Checking: mi-api                            │
│    [DEBUG] 11:23:46 - git fetch completed                      │
│    [DEBUG] 11:23:47 - Changes detected (3 new commits)         │
│    [INFO] 11:23:48 Updating mi-api...                          │
│    [DEBUG] 11:23:49 - git pull completed                       │
│    [DEBUG] 11:23:52 - yarn build completed                     │
│    [DEBUG] 11:23:55 - pm2 restart completed                    │
│    [INFO] 11:23:56 mi-api updated successfully                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         Vuelve a Paso 3 (POLLER) después de 10 seg
```

---

## ✨ VENTAJAS DE ESTA ESTRUCTURA

### 1. **MODULAR Y TESTEABLE**
```typescript
// Fácil de testear cada parte independientemente
describe('Scanner', () => {
  it('should find git folders', () => {
    const repos = scanner.scan(testReposPath);
    expect(repos.length).toBeGreaterThan(0);
  });
});
```

### 2. **ESCALABLE - VANILLA STACK (SIN DEPENDENCIAS EXTERNAS)**
```json
{
  "dependencies": {
    "simple-git": "^3.20.0",     // Solo para git
    "pm2": "^5.3.0",              // Solo para restart apps
    "yargs": "^17.7.2",           // Solo para CLI
    "pino": "^8.17.0",            // Solo para logs
    "dotenv": "^16.3.1"           // Solo para env vars
  }
}
```
✅ **Ventaja:** No requiere Redis, RabbitMQ, BullMQ
✅ **Ventaja:** Deploying es simple: un comando en terminal
✅ **Ventaja:** Menos dependencias = menos bugs

### 3. **SEGURIDAD CON LOCKS (Previene race conditions)**
```typescript
// Worker solo puede correr una vez por repo
if (fs.existsSync('.deploying')) {
  logger.warn('Already updating, skipping...');
  return;
}
// Ejecuta actualización...
fs.unlinkSync('.deploying'); // Libera lock
```

### 4. **FLEXIBLE CON ENV VARS + CLI**
```bash
# Opción 1: Variables de entorno
POLL_INTERVAL=10000 REPOS_ROOT=~/my-repos yarn dev start

# Opción 2: CLI flags
yarn dev start --poll-interval 10000 --repos-root ~/my-repos

# Opción 3: Mezcla (CLI gana)
POLL_INTERVAL=30000 yarn dev start --poll-interval 10000  # Usa 10000
```

### 5. **DUAL OUTPUT - PUEDES USAR COMO DEPENDENCIA**
```typescript
// dist/cjs/  → Para require() (CommonJS)
const { startDaemon } = require('devops-custom');

// dist/esm/  → Para import (ES Modules)
import { startDaemon } from 'devops-custom';

// TypeScript support
import type { Repository } from 'devops-custom';
```

### 6. **CI/CD READY**
```bash
# Todo automatizado en release.sh
1. yarn build        → Compila con tests
2. Bump version      → Actualiza package.json
3. git tag           → Crea tag de release
4. npm publish       → Publica a npm
5. git push --tags   → Push a GitHub
```

### 7. **LOGGING ESTRUCTURADO**
```typescript
logger.info('Starting daemon', { pollInterval: 10000 });
logger.debug('Git fetch completed');
logger.warn('Repo locked, skipping');
logger.error('Build failed', error);
```

---

## 🧪 ¿CÓMO HACEMOS PRUEBAS UNITARIAS?

### Estructura de Tests
```
__tests__/
├── core/
│   └── scanner.test.ts         ← Test: ¿scanner encuentra repos?
├── utils/
│   ├── logger.test.ts          ← Test: ¿logger registra bien?
│   ├── git.test.ts             ← Test: ¿git pull/fetch van bien?
│   ├── pm2.test.ts             ← Test: ¿pm2 restart va bien?
│   └── lock.test.ts            ← Test: ¿lock/unlock funcionan?
└── integration/
    └── e2e.test.ts             ← Test: ¿todo junto funciona?
```

### Ejemplo de Test Unitario
```typescript
// __tests__/core/scanner.test.ts
import { scanner } from '../../src/core/scanner';

describe('Scanner', () => {
  it('should find git repositories', () => {
    const repos = scanner.scan(testReposPath);
    
    expect(repos).toBeDefined();
    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0]).toHaveProperty('name');
    expect(repos[0]).toHaveProperty('path');
  });

  it('should filter hidden folders', () => {
    const repos = scanner.scan(testReposPath);
    
    repos.forEach(repo => {
      expect(repo.path).not.toMatch(/\/\./);  // No paths contain /.
    });
  });

  it('should load config from .devops-custom.json', () => {
    const repos = scanner.scan(testReposPath);
    const repoWithConfig = repos.find(r => r.name === 'my-api');
    
    expect(repoWithConfig.config).toBeDefined();
    expect(repoWithConfig.config.buildCommand).toBe('yarn build');
  });
});
```

### Ejemplo de Test de Integración
```typescript
// __tests__/integration/e2e.test.ts
describe('Full Daemon Cycle', () => {
  it('should detect changes and update repo', async () => {
    // 1. Crear repo test
    await createTestRepo();
    
    // 2. Hacer cambios (simular push)
    await makeChangesToRepo();
    
    // 3. Correr scanner
    const repos = scanner.scan(testRoot);
    
    // 4. Correr worker
    const result = await worker.update(repos[0]);
    
    // 5. Verificar resultado
    expect(result.success).toBe(true);
    expect(result.message).toContain('updated successfully');
  });
});
```

### Cómo Ejecutar Tests
```bash
# Todos los tests
yarn test
# Salida: PASS __tests__/core/scanner.test.ts
#         PASS __tests__/utils/logger.test.ts
#         Coverage: 85%

# En modo watch (re-run al cambiar archivos)
yarn test:watch

# Solo E2E tests
yarn test:e2e --forceExit

# Con cobertura detallada
yarn test --coverage
```

### Cobertura Esperada
```
Statements   : 90% ( líneas de código ejecutadas )
Branches     : 85% ( todas las ramas if/else probadas )
Functions    : 90% ( todas las funciones llamadas )
Lines        : 90% ( todas las líneas ejecutadas )
```

---

## 🚀 ¿CÓMO SE EJECUTA?

### Opción 1: Desarrollo (Durante implementación)
```bash
cd ~/dev/devops-custom

# Ejecutar en desarrollo
yarn dev start

# Con configuración custom
POLL_INTERVAL=5000 yarn dev start --repos-root ~/my-projects

# Con logs detallados
LOG_LEVEL=debug yarn dev start
```

### Opción 2: Producción (Compilado)
```bash
# Compilar
yarn build
# Genera:
# ├── dist/cjs/        (CommonJS)
# ├── dist/esm/        (ES Modules)
# ├── dist/types/      (TypeScript definitions)
# └── docs/            (API Documentation)

# Ejecutar compilado
node dist/cjs/cli.js start --poll-interval 5000

# O con npm script
npm start
```

### Opción 3: Como PM2 Service
```bash
# Instalar globalmente
npm install -g devops-custom

# O agregar a proyecto existente
npm install devops-custom

# Ejecutar con PM2
pm2 start "devops-custom start" --name devops-custom
pm2 save            # Guardar config
pm2 startup         # Ejecutar en booteo del sistema
```

### Verificar Ejecución
```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs devops-custom

# Detener
pm2 stop devops-custom

# Eliminar
pm2 delete devops-custom
```

---

## 📦 ¿CÓMO AGREGAR COMO DEPENDENCIA?

### Opción 1: Desde npm (Una vez publicado)
```bash
npm install devops-custom
# o
yarn add devops-custom
```

### Opción 2: Desde Git (Durante desarrollo)
```bash
# Sin publicar en npm aún, usar como local dependency
yarn add file:../devops-custom

# En package.json:
{
  "dependencies": {
    "devops-custom": "file:../devops-custom"
  }
}
```

### Opción 3: Usar en Otro Proyecto
```typescript
// mi-proyecto/src/index.ts
import { startDaemon, Scanner } from 'devops-custom';

// O para CommonJS
const { startDaemon } = require('devops-custom');

// Usarlo programáticamente
const daemon = await startDaemon({
  pollInterval: 10000,
  reposRoot: '/home/user/projects'
});

daemon.stop(); // Detener
```

### Type Definitions (TypeScript)
```typescript
// Automáticamente disponible desde dist/types/
import type { 
  Repository, 
  PollerOptions, 
  UpdateResult 
} from 'devops-custom';

const config: PollerOptions = {
  pollInterval: 5000,
  reposRoot: '~/projects',
  logLevel: 'debug'
};
```

### API Pública Exportada
```typescript
// Lo que puedes importar desde 'devops-custom':

export { logger }          // Pino logger instance
export { startDaemon }     // Función principal
export { Scanner }         // Clase scanner
export { Poller }          // Clase poller
export { Worker }          // Clase worker

// Types
export type { 
  Repository, 
  PollerOptions, 
  UpdateResult, 
  DiabliteConfig 
}
```

---

## 📊 COMPARATIVA: Manual vs DevOps Custom

| Aspecto | Manual | DevOps Custom |
|--------|--------|---------|
| **Actualizar API** | `cd api && git pull && yarn build && pm2 restart api` | ✅ Automático |
| **Actualizar 5 repos** | 5× lo anterior + 15 min | ✅ 1 comando, simultáneo |
| **Logs** | Dispersos en terminal | ✅ Structured Pino logs |
| **Fallos** | ❌ Sin retry automático | ✅ Retry + logs detallados |
| **Monitoreo** | ❌ No hay | ✅ Comando status |
| **Downtime** | ❌ Manual window | ✅ Cambios detectados al instante |

---

## 🎯 PRÓXIMOS PASOS ORDENADOS

### Hoy (Setup)
```bash
cd ~/dev/devops-custom
yarn install          # 2 min
cp .env.example .env  # 30 seg
yarn test             # Verifica setup
```

### Mañana (Fase 1 - Implementación)
1. **`src/core/scanner.ts`** (2 horas)
   - Buscar `.git` recursivamente
   - Filtrar `.` folders
   - Extraer remotes

2. **`src/utils/git.ts`** (1.5 horas)
   - Wrappers de simple-git
   - fetch, rev-list, pull

3. **`src/core/worker.ts`** (2 horas)
   - git pull, build, pm2 restart
   - Lock system
   - Error handling

4. **`src/core/poller.ts`** (1.5 horas)
   - Loop cada POLL_INTERVAL
   - Cambios detectados
   - Secuencial

5. **`src/cli/commands/start.ts`** (1 hora)
   - Conectar scanner + poller
   - Signal handlers

### Fin de semana (Fase 2 & 3)
6. Utilities: pm2.ts, lock.ts
7. CLI commands: scan.ts, status.ts
8. Tests
9. Documentación
10. Publicar a npm

---

## ✅ CHECKLIST RÁPIDO

- [ ] ¿Entiendes qué hace DevOps Custom? (daemon que auto-actualiza repos)
- [ ] ¿Entiendes flujo: CLI → Scanner → Poller → Worker?
- [ ] ¿Entiendes env vars + CLI para config?
- [ ] ¿Entiendes que es VANILLA (sin Redis)?
- [ ] ¿Entiendes testing con Jest?
- [ ] ¿Sabes cómo ejecutarlo (yarn dev start)?
- [ ] ¿Sabes publicarlo como dependencia npm?

Si respondiste SÍ a todo → **¡Listo para comenzar!** Abre `src/core/scanner.ts`

---

## 📞 TL;DR (Resumen de 30 segundos)

**¿Qué es?** Daemon que auto-actualiza repos cada 5 min

**¿Estructura?** CLI → Scanner (busca repos) → Poller (verifica cambios) → Worker (git pull/build/restart)

**¿Ventajas?** VANILLA (sin dependencias externas), modular, testeable, escalable

**¿Tests?** Jest en `__tests__/`, ejecutar con `yarn test`

**¿Ejecutar?** `yarn dev start` o publicar y usar como npm package

**¿Dependencia?** `npm install devops-custom` una vez publicado

---

**Siguiente paso:** `yarn install` y luego implementar `src/core/scanner.ts` 🚀
