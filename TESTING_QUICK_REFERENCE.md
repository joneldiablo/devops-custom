# 🧪 QUICK REFERENCE - Mocks por Módulo

> Guía rápida: cuando implementes un módulo, ve aquí y copia los mocks necesarios

---

## ESTRUCTURA RÁPIDA

```
Implementando → Busca el módulo abajo → Copia los mocks → Copia el test template
```

---

## 1️⃣ SCANNER.TS

**Ubicación:** `src/core/scanner.ts`
**Test:** `__tests__/core/scanner.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('fs');
jest.mock('simple-git');
jest.mock('../../src/utils/git');
jest.mock('../../src/utils/logger');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  // Mock filesystem
  (fs.readdirSync as jest.Mock).mockReturnValue(['repo1', 'repo2', '.cache']);
  (fs.existsSync as jest.Mock).mockImplementation(path => 
    path.includes('.git')
  );
  (fs.readFileSync as jest.Mock).mockReturnValue(
    JSON.stringify({ branch: 'main' })
  );

  // Mock git utilities
  (gitUtils.getRemoteUrl as jest.Mock).mockResolvedValue(
    'https://github.com/user/repo.git'
  );

  // Logger no necesita valores de retorno
});
```

### Tests Clave
- [ ] Find repos recursively
- [ ] Filter hidden folders (. prefix)
- [ ] Extract remote URL
- [ ] Load .devops-custom.json
- [ ] Handle errors gracefully

---

## 2️⃣ GIT.TS (Utilities)

**Ubicación:** `src/utils/git.ts`
**Test:** `__tests__/utils/git.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('simple-git');
jest.mock('../../src/utils/logger');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  const mockGit = {
    fetch: jest.fn().mockResolvedValue({}),
    pull: jest.fn().mockResolvedValue({}),
    getRemotes: jest.fn().mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
    ]),
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

### Tests Clave
- [ ] fetch(repoPath) ejecuta fetch
- [ ] getRemoteUrl(repoPath) extrae URL
- [ ] pull(repoPath) ejecuta pull
- [ ] hasChanges usa rev-list
- [ ] getCurrentBranch retorna rama
- [ ] Error handling con try/catch

---

## 3️⃣ WORKER.TS

**Ubicación:** `src/core/worker.ts`
**Test:** `__tests__/core/worker.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('../../src/utils/git');
jest.mock('../../src/utils/pm2');
jest.mock('../../src/utils/lock');
jest.mock('../../src/utils/logger');
jest.mock('fs');
jest.mock('child_process');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  // Git utilities
  (gitUtils.pull as jest.Mock).mockResolvedValue(true);
  (gitUtils.fetch as jest.Mock).mockResolvedValue(true);

  // PM2 utilities
  (pm2Utils.restart as jest.Mock).mockResolvedValue({
    success: true,
    message: 'Restarted'
  });

  // Lock utilities
  (lockUtils.isLocked as jest.Mock).mockReturnValue(false);
  (lockUtils.acquire as jest.Mock).mockResolvedValue(true);
  (lockUtils.release as jest.Mock).mockResolvedValue(true);

  // Filesystem
  (fs.existsSync as jest.Mock).mockReturnValue(false);
  (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  (fs.unlinkSync as jest.Mock).mockImplementation(() => {});

  // Child process
  (exec as jest.Mock).mockImplementation((cmd, cb) => {
    cb(null, 'Built successfully\n', '');
  });
});
```

### Tests Clave
- [ ] Acquire lock before update
- [ ] Execute git pull
- [ ] Execute build command
- [ ] Execute pm2 restart
- [ ] Release lock after update
- [ ] Release lock even if error
- [ ] Handle locked repo
- [ ] Handle git error
- [ ] Return UpdateResult

---

## 4️⃣ POLLER.TS

**Ubicación:** `src/core/poller.ts`
**Test:** `__tests__/core/poller.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('../../src/core/scanner');
jest.mock('../../src/core/worker');
jest.mock('../../src/utils/git');
jest.mock('../../src/utils/logger');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers(); // ⚠️ IMPORTANTE para setInterval

  // Scanner retorna lista de repos
  (scanner.scan as jest.Mock).mockResolvedValue([
    { path: '/repo1', name: 'repo1' },
    { path: '/repo2', name: 'repo2' },
  ]);

  // Worker retorna result
  (worker.update as jest.Mock).mockResolvedValue({
    success: true,
    message: 'Updated',
    repository: { path: '/repo1', name: 'repo1' },
    timestamp: new Date(),
  });

  // Git utilities
  (git.hasChanges as jest.Mock).mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers(); // ⚠️ IMPORTANTE limpiar timers
});
```

### Tests Clave
- [ ] Setup interval cada POLL_INTERVAL
- [ ] Loop sequencial (for...await)
- [ ] Detectar cambios con git.hasChanges
- [ ] Llamar worker solo si hay cambios
- [ ] Manejar errores sin detener loop
- [ ] Log resultados
- [ ] Can stop/pause

---

## 5️⃣ LOCK.TS (Utilities)

**Ubicación:** `src/utils/lock.ts`
**Test:** `__tests__/utils/lock.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('fs');
jest.mock('../../src/utils/logger');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  // Lock file existence
  (fs.existsSync as jest.Mock).mockReturnValue(false);
  (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
  (fs.statSync as jest.Mock).mockReturnValue({
    mtimeMs: Date.now(),
  });
});
```

### Tests Clave
- [ ] acquire(path) crea .deploying
- [ ] isLocked(path) verifica existencia
- [ ] release(path) elimina .deploying
- [ ] Handle stale locks (>timeout)
- [ ] Concurrent access prevention

---

## 6️⃣ PM2.TS (Utilities)

**Ubicación:** `src/utils/pm2.ts`
**Test:** `__tests__/utils/pm2.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('pm2');
jest.mock('../../src/utils/logger');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  const mockPm2 = {
    connect: jest.fn((done) => done()),
    disconnect: jest.fn(),
    restart: jest.fn((name, done) => {
      done(null, [{ pm_id: 0, name, status: 'online' }]);
    }),
    describe: jest.fn((name, done) => {
      done(null, [{ name, status: 'online', pid: 1234 }]);
    }),
    start: jest.fn((name, done) => {
      done(null, [{ pm_id: 0, name, status: 'online' }]);
    }),
  };

  (require('pm2') as jest.Mock).mockImplementation(() => mockPm2);
});
```

### Tests Clave
- [ ] connect() establece conexión
- [ ] restart(appName) reinicia app
- [ ] describe(appName) obtiene status
- [ ] disconnect() cierra conexión
- [ ] Handle app not found
- [ ] Handle PM2 not running

---

## 7️⃣ LOGGER.TS (Ya Implementado)

**Ubicación:** `src/utils/logger.ts`
**Test:** `__tests__/utils/logger.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('pino');
```

### Mock Template
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  (pino as jest.Mock).mockReturnValue(mockLogger);
});
```

### Tests Clave
- [ ] debug() funciona
- [ ] info() funciona
- [ ] warn() funciona
- [ ] error() funciona
- [ ] Respeta LOG_LEVEL env var

---

## 8️⃣ CLI COMMANDS

### start.ts
**Ubicación:** `src/cli/commands/start.ts`
**Test:** `__tests__/cli/commands/start.test.ts`

### Dependencias a Mockear
```typescript
jest.mock('../../src/core/poller');
jest.mock('../../src/core/scanner');
jest.mock('../../src/utils/logger');
```

### Tests Clave
- [ ] Lee POLL_INTERVAL de env
- [ ] Lee REPOS_ROOT de env
- [ ] CLI flags override env
- [ ] Llama scanner.scan()
- [ ] Llama poller.start()
- [ ] Maneja SIGTERM
- [ ] Maneja SIGINT

---

### scan.ts
**Dependen cias:** scanner, logger
**Tests:**
- [ ] Obtiene repos de scanner
- [ ] Imprime lista
- [ ] Maneja errores

---

### status.ts
**Dependencias:** pm2 utils, logger
**Tests:**
- [ ] Query daemon status
- [ ] Muestra repos activos
- [ ] Muestra último update

---

## ⚡ CHECKLIST RÁPIDO

### Para CADA módulo que implementes:

```
[ ] 1. Jest.mock() todos los imports externos y locales
[ ] 2. beforeEach(): setup todos los mocks
[ ] 3. jest.clearAllMocks() en beforeEach
[ ] 4. Si usa timers: jest.useFakeTimers()
[ ] 5. Si usa timers: jest.useRealTimers() en afterEach
[ ] 6. Escribe 3-5 tests core
[ ] 7. Implementa el módulo
[ ] 8. yarn test --coverage
[ ] 9. Verifica > 90% coverage
[ ] 10. Commit con test incluido
```

---

## 🔍 DEBUGGING: Si el test falla

### Error: "Cannot read property 'X' of undefined"
```typescript
// Tu mock no retorna lo esperado
// Verifica que retorna la estructura correcta

// ❌ MALO
(simpleGit as jest.Mock).mockReturnValue(null);

// ✅ BUENO
(simpleGit as jest.Mock).mockReturnValue({
  fetch: jest.fn().mockResolvedValue({}),
  pull: jest.fn().mockResolvedValue({}),
});
```

### Error: "Expected mock function to have been called"
```typescript
// Verifica que importaste correctamente
// y que el mock está en place

// Imprime los calls:
console.log('Mock was called with:', gitUtils.pull.mock.calls);
```

### Error: "Timeout - Async callback was not invoked"
```typescript
// Si usas async/await, asegúrate de
// que mockResolvedValue está siendo resuelto

// ✅ CORRECTO
(scannerMock as jest.Mock).mockResolvedValue([...]);

// ❌ INCORRECTO  
(scannerMock as jest.Mock).mockReturnValue([...]);
```

### Error: "localStorage is not defined"
```typescript
// No debería pasar en devops-custom
// Pero si necesitas mockear browser APIs:

global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
```

---

## 📊 TESTING METRICS

Después de cada test, revisa:

```bash
yarn test --coverage
```

Busca:
- **Statements ≥ 90%** - Cada línea ejecutada
- **Branches ≥ 85%** - Cada if/else probado
- **Functions ≥ 90%** - Cada función llamada
- **Lines ≥ 90%** - Cada línea probada

Si alguna cae < target:
1. Abre el archivo en `/coverage/lcov-report/`
2. Identifica líneas no cubiertas
3. Agregá tests para esas líneas

---

## 🚀 COPIA RÁPIDA

### Copiar toda la estructura de mocks para un nuevo test:

```bash
# 1. Busca un test similar (ej: para implementar "foo.ts")
# 2. Copia este archivo 
# 3. Actualiza paths e imports
# 4. Actualiza nombres de mocks
# 5. Listo!

# Es más rápido que escribir desde 0
```

---

## ✅ CUANDO TERMINA CADA MÓDULO

```typescript
// 1. ✅ Test passing
PASS __tests__/core/scanner.test.ts

// 2. ✅ Coverage good
Statements: 100%

// 3. ✅ Mocks completes (sin warnings)
No warnings

// 4. ✅ Implementación compilable
yarn build:cjs (sin errores)

// 5. ✅ Ready para siguiente módulo
→ Siguiente
```

---

**¡Guía de referencia lista! Úsala mientras codificas.** 🚀
