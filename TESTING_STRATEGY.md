# 🧪 Testing Strategy - DevOps Custom

## PRINCIPIO FUNDAMENTAL: ALL DEPENDENCIES ARE MOCKED

> **Este es un principio crítico del proyecto.** Todas las pruebas unitarias deben mockear TODAS las dependencias locales y externas. Esto permite tests rápidos, aislados y confiables que no dependen de estado externo.

---

## ¿POR QUÉ MOCKEAR TODO?

### ✅ Ventajas

| Ventaja | Explicación |
|---------|------------|
| **Tests Rápidos** | No ejecutan git, no escriben en filesystem, no launcha PM2 |
| **Aislamiento** | Cada test es independiente, sin efectos secundarios |
| **Confiabilidad** | Tests no fallan por cambios en sistema externo |
| **Fácil de Debuggear** | Puedes verificar qué se llamó y con qué parámetros |
| **CI/CD Compatible** | No requiere git, PM2, o estructura de repos |
| **Rápido Feedback** | La suite completa corre en < 5 segundos |

### ❌ What NOT to do

```typescript
// ❌ MALO: Test sin mocks (accede a filesystem real)
it('should scan repos', async () => {
  const repos = await scanner.scan(path.expandUser('~/projects'));
  expect(repos.length).toBeGreaterThan(0);
});

// ❌ MALO: Test ejecuta comando real
it('should pull changes', async () => {
  await git.pull('/real/repo/path');  // Accede a git real!
  expect(fs.existsSync('/real/repo/path/.git')).toBe(true);
});

// ✅ BUENO: Test mockea dependencias
it('should scan repos', async () => {
  const mockFs = {
    readdirSync: jest.fn().mockReturnValue(['repo1', 'repo2']),
  };
  const repos = await scanner.scan('/test/path', mockFs);
  expect(repos.length).toBe(2);
});
```

---

## TIPOS DE MOCKS EN DEVOPS-CUSTOM

### 1. MOCKS DE DEPENDENCIAS EXTERNAS

**Qué se mockea:**
- `fs` (filesystem) - `readdirSync`, `existsSync`, `readFileSync`, `writeFileSync`, `unlinkSync`
- `fs.promises` - `readFile`, `writeFile`, `rm`
- `path` - funciones de expansión de rutas
- `simple-git` - toda la instancia de SimpleGit
- `pm2` - métodos `restart`, `describe`, `connect`, `disconnect`
- `child_process` - `exec`, `execSync` para comandos de shell
- `process` - `env` variables, `exit`, `on` signals

**Ejemplo:**

```typescript
// __tests__/core/scanner.test.ts
import * as fs from 'fs';
import { scanner } from '../../src/core/scanner';

jest.mock('fs');
jest.mock('simple-git');

describe('Scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should find git repositories', () => {
    // Mock del filesystem
    (fs.readdirSync as jest.Mock).mockReturnValue(['repo1', 'repo2']);
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      return path.endsWith('.git');
    });

    const repos = scanner.scan('/test/path');
    
    expect(repos).toHaveLength(2);
    expect(fs.readdirSync).toHaveBeenCalledWith('/test/path');
  });
});
```

### 2. MOCKS DE DEPENDENCIAS LOCALES

**Qué se mockea:**
- `logger` - métodos `info`, `debug`, `warn`, `error`
- `git` utilities - `fetch`, `pull`, `hasChanges`, `getCurrentBranch`
- `pm2` utilities - `restart`, `describe`
- `lock` utilities - `acquire`, `release`, `isLocked`

**Ejemplo:**

```typescript
// __tests__/core/worker.test.ts
import { worker } from '../../src/core/worker';
import * as gitUtils from '../../src/utils/git';
import * as lockUtils from '../../src/utils/lock';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/utils/git');
jest.mock('../../src/utils/lock');
jest.mock('../../src/utils/logger');

describe('Worker', () => {
  it('should update repository', async () => {
    // Mock de git utilities
    (gitUtils.pull as jest.Mock).mockResolvedValue({ success: true });
    (gitUtils.execBuild as jest.Mock).mockResolvedValue({});
    
    // Mock de lock utilities
    (lockUtils.acquire as jest.Mock).mockResolvedValue(true);
    (lockUtils.release as jest.Mock).mockResolvedValue(true);

    const repo = { path: '/test/repo', name: 'test' };
    const result = await worker.update(repo);
    
    expect(result.success).toBe(true);
    expect(gitUtils.pull).toHaveBeenCalledWith('/test/repo');
    expect(lockUtils.acquire).toHaveBeenCalled();
  });
});
```

### 3. MOCKS DE STATE Y CONFIG

**Qué se mockea:**
- Archivos de configuración (`.devops-custom.json`, `.env`)
- Variables de entorno (`process.env`)
- Estado global del daemon

**Ejemplo:**

```typescript
// __tests__/cli/commands/start.test.ts
describe('Start Command', () => {
  beforeEach(() => {
    // Mock process.env
    process.env.POLL_INTERVAL = '10000';
    process.env.REPOS_ROOT = '/test/projects';
    process.env.LOG_LEVEL = 'debug';
  });

  afterEach(() => {
    delete process.env.POLL_INTERVAL;
    delete process.env.REPOS_ROOT;
    delete process.env.LOG_LEVEL;
  });

  it('should read env vars correctly', async () => {
    const argv = {
      'poll-interval': undefined, // Usar del .env
      'repos-root': undefined,
      'log-level': undefined,
    };

    const config = getConfigFromEnv();
    
    expect(config.pollInterval).toBe(10000);
    expect(config.reposRoot).toBe('/test/projects');
  });
});
```

---

## ESTRUCTURA DE MOCKS POR MÓDULO

### `__tests__/core/scanner.test.ts` - Mocks necesarios

```typescript
// Dependencias externas
jest.mock('fs');
jest.mock('path');
jest.mock('simple-git');

// Dependencias locales
jest.mock('../../src/utils/logger');

// Mocks típicos
beforeEach(() => {
  // Reset todos los mocks
  jest.clearAllMocks();
  
  // Mock de fs.readdirSync (retorna carpetas)
  (fs.readdirSync as jest.Mock).mockReturnValue([
    'repo1',  // Carpeta normal
    'repo2',
    '.cache', // Carpeta oculta (debe ser filtrada)
    '.git',   // Carpeta oculta
  ]);
  
  // Mock de fs.existsSync (.git existe en repo1, repo2)
  (fs.existsSync as jest.Mock).mockImplementation((path) => {
    return path.includes('repo1') || path.includes('repo2');
  });
  
  // Mock de simple-git para extraer remote origin
  (simpleGit as jest.Mock).mockReturnValue({
    getRemotes: jest.fn().mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/user/repo1.git' } }
    ]),
  });
});
```

### `__tests__/core/poller.test.ts` - Mocks necesarios

```typescript
jest.mock('../../src/core/scanner');
jest.mock('../../src/core/worker');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/git');

beforeEach(() => {
  jest.useFakeTimers();
  
  // Mock de scanner (retorna lista de repos)
  (scanner.scan as jest.Mock).mockResolvedValue([
    { path: '/repo1', name: 'repo1' },
    { path: '/repo2', name: 'repo2' },
  ]);
  
  // Mock de worker (retorna UpdateResult)
  (worker.update as jest.Mock).mockResolvedValue({
    success: true,
    message: 'Updated',
    repository: { path: '/repo1', name: 'repo1' },
    timestamp: new Date(),
  });
  
  // Mock de git.hasChanges
  (git.hasChanges as jest.Mock).mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});
```

### `__tests__/core/worker.test.ts` - Mocks necesarios

```typescript
jest.mock('../../src/utils/git');
jest.mock('../../src/utils/pm2');
jest.mock('../../src/utils/lock');
jest.mock('../../src/utils/logger');
jest.mock('fs');
jest.mock('child_process');

beforeEach(() => {
  // Mock de git operations
  (gitUtils.pull as jest.Mock).mockResolvedValue({ success: true });
  (gitUtils.execBuild as jest.Mock).mockResolvedValue({ stdout: 'Built' });
  
  // Mock de pm2
  (pm2Utils.restart as jest.Mock).mockResolvedValue({ success: true });
  
  // Mock de lock
  (lockUtils.acquire as jest.Mock).mockResolvedValue(true);
  (lockUtils.release as jest.Mock).mockResolvedValue(true);
  (lockUtils.isLocked as jest.Mock).mockReturnValue(false);
});
```

### `__tests__/utils/git.test.ts` - Mocks necesarios

```typescript
jest.mock('simple-git');
jest.mock('../../src/utils/logger');

beforeEach(() => {
  // Mock de SimpleGit instance
  const mockGit = {
    fetch: jest.fn().mockResolvedValue({}),
    pull: jest.fn().mockResolvedValue({}),
    revparse: jest.fn().mockResolvedValue('abc123'),
    revList: jest.fn().mockResolvedValue(['abc123', 'def456']),
    status: jest.fn().mockResolvedValue({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 5,
    }),
  };

  (simpleGit as jest.Mock).mockReturnValue(mockGit);
});
```

### `__tests__/utils/pm2.test.ts` - Mocks necesarios

```typescript
jest.mock('pm2');
jest.mock('../../src/utils/logger');

beforeEach(() => {
  const mockPm2 = {
    connect: jest.fn((done) => done()),
    disconnect: jest.fn(),
    restart: jest.fn((name, done) => {
      done(null, [{ pm_id: 0, name, status: 'online' }]);
    }),
    describe: jest.fn((name, done) => {
      done(null, [{ name, status: 'online', pid: 1234 }]);
    }),
  };

  (require('pm2') as jest.Mock).mockImplementation(() => mockPm2);
});
```

### `__tests__/utils/lock.test.ts` - Mocks necesarios

```typescript
jest.mock('fs');
jest.mock('../../src/utils/logger');

beforeEach(() => {
  (fs.existsSync as jest.Mock).mockReturnValue(false);
  (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
});
```

---

## TESTING PATTERNS

### Pattern 1: Test que verifica comportamiento con cambios
```typescript
it('should update repo when changes detected', async () => {
  // Arrange - setup mocks
  (git.hasChanges as jest.Mock).mockResolvedValue(true);
  (worker.update as jest.Mock).mockResolvedValue({
    success: true,
    message: 'Updated',
  });

  // Act
  const result = await poller.checkAndUpdate(repo);

  // Assert
  expect(worker.update).toHaveBeenCalledWith(repo);
  expect(result.success).toBe(true);
});
```

### Pattern 2: Test que verifica no-op cuando sin cambios
```typescript
it('should skip update when no changes detected', async () => {
  (git.hasChanges as jest.Mock).mockResolvedValue(false);

  const result = await poller.checkAndUpdate(repo);

  expect(worker.update).not.toHaveBeenCalled();
});
```

### Pattern 3: Test error handling
```typescript
it('should handle git fetch error gracefully', async () => {
  (git.fetch as jest.Mock).mockRejectedValue(
    new Error('Network error')
  );

  const result = await worker.update(repo);

  expect(result.success).toBe(false);
  expect(result.error).toContain('Network error');
  expect(logger.error).toHaveBeenCalled();
});
```

### Pattern 4: Test lock mechanism
```typescript
it('should not update if lock exists', async () => {
  (lockUtils.isLocked as jest.Mock).mockReturnValue(true);

  const result = await worker.update(repo);

  expect(result.success).toBe(false);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('locked')
  );
  expect(git.pull).not.toHaveBeenCalled();
});
```

### Pattern 5: Test signal handling (destroy mocks between tests)
```typescript
describe('Signal Handling', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it('should gracefully shutdown on SIGTERM', async () => {
    const mockProcess = {
      on: jest.fn(),
      exit: jest.fn(),
    };

    process.on = mockProcess.on;

    startDaemon();

    expect(mockProcess.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });
});
```

---

## CHECKLIST: AGREGAR MOCKS CUANDO HACES CAMBIOS

Cuando implementes o modifiques código, **SIEMPRE** verifica que los tests tengan mocks:

- [ ] **¿Usa `fs`?** → Mock `fs.readFileSync`, `fs.writeFileSync`, etc
- [ ] **¿Usa `simple-git`?** → Mock la instancia de git y sus métodos
- [ ] **¿Usa `pm2`?** → Mock los métodos de pm2
- [ ] **¿Usa `child_process`?** → Mock `exec`, `execSync`
- [ ] **¿Usa otra utilidad local?** → Mock esa dependencia con `jest.mock(...)`
- [ ] **¿Lee `.env`?** → Mock `process.env`
- [ ] **¿Llama `logger`?** → Mock el logger para verificar mensajes
- [ ] **¿Usa timers (setInterval)?** → Usa `jest.useFakeTimers()` y `jest.runAllTimers()`
- [ ] **¿Hace promises?** → Usa `mockResolvedValue` o `mockRejectedValue`

---

## VERIFICACIÓN DE COBERTURA

### Ejecutar tests con cobertura
```bash
yarn test --coverage
```

### Salida esperada
```
PASS __tests__/core/scanner.test.ts
PASS __tests__/core/poller.test.ts
PASS __tests__/core/worker.test.ts
PASS __tests__/utils/git.test.ts
PASS __tests__/utils/pm2.test.ts  
PASS __tests__/utils/lock.test.ts
PASS __tests__/utils/logger.test.ts

======================== Coverage Summary ========================
Statements   : 90.1% ( 200/222 )
Branches     : 85.3% ( 52/61 )
Functions    : 92.0% ( 46/50 )
Lines        : 91.5% ( 203/222 )
```

### Meta de cobertura
- **Statements:** ≥ 90% (cada línea ejecutada)
- **Branches:** ≥ 85% (cada if/else probado)
- **Functions:** ≥ 90% (cada función llamada)
- **Lines:** ≥ 90% (cada línea física probada)

---

## INTEGRACIÓN CON CI/CD

Los tests MOCKEADOS funcionan perfectamente en CI/CD porque:

✅ No requieren git real
✅ No requieren PM2 instalado
✅ No requieren filesystem especial
✅ Corren rápido (< 5 segundos)
✅ No dejan "basura" en el sistema
✅ Son 100% determinísticos (no flaky)

---

## TROUBLESHOOTING

### Problem: "Test is failing intermittently"
**Cause:** Probablemente no estés mockeando algo
**Solution:** Agrega `jest.mock()` para la dependencia que falta

### Problem: "TypeError: Cannot read property of undefined"
**Cause:** Un mock no está retornando el objeto esperado
**Solution:** Verifica que el mock retorne la estructura correcta

```typescript
// ❌ MALO
(simpleGit as jest.Mock).mockReturnValue(null);

// ✅ BUENO
(simpleGit as jest.Mock).mockReturnValue({
  fetch: jest.fn().mockResolvedValue({}),
  pull: jest.fn().mockResolvedValue({}),
});
```

### Problem: "Tests pass locally but fail in CI"
**Cause:** Dependencia del estado externo o sistema
**Solution:** Agrega más mocks, usa `jest.useFakeTimers()`

---

## RESUMEN RÁPIDO

| Concepto | Implementación |
|----------|----------------|
| **Mock externo** | `jest.mock('fs')` y usar `jest.Mock` |
| **Mock local** | `jest.mock('../../src/utils/git')` |
| **Verificar llamada** | `expect(func).toHaveBeenCalledWith(...)` |
| **Return value** | `.mockReturnValue(...)` o `.mockResolvedValue(...)` |
| **Error** | `.mockRejectedValue(new Error(...))` |
| **Timers** | `jest.useFakeTimers()` y `jest.runAllTimers()` |
| **Cleanup** | `jest.clearAllMocks()` en `beforeEach` |

---

## PRÓXIMOS PASOS

Cuando implementes código, SIEMPRE:
1. Escribe el test primero (TDD pattern optativo pero recomendado)
2. Mockea TODAS las dependencias
3. Verifica que el test falla
4. Implementa el código
5. Verifica que el test pasa
6. Verifica cobertura: `yarn test --coverage`

**¡Los mocks son tus amigos!** 🚀
