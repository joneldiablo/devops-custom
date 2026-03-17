# 📌 TESTING INTEGRATION GUIDE - DevOps Custom

> Cómo integrar mocks y testing en tu flujo de desarrollo mientras implementas cada módulo

---

## FLUJO: Implementar + Testear + Verificar Mocks

```
1. LEER TODO COMENTARIO
        ↓
2. ESCRIBIR TEST CON MOCKS
        ↓
3. IMPLEMENTAR CÓDIGO
        ↓
4. EJECUTAR TEST
        ↓
5. VERIFICAR COBERTURA
        ↓
6. COMMIT CON TEST INCLUIDO
```

---

## FASE 1: IMPLEMENTAR `scanner.ts`

### Paso 1: Leer el TODO actual
```typescript
// src/core/scanner.ts

// TODO: Implement scanner
// - recursively find all .git folders
// - filter hidden folders (starting with ".")
// - extract remote origin URL
// - load .devops-custom.json config per repo
// - return Repository[] in memory
```

### Paso 2: Escribir primero el TEST (con mocks)
```typescript
// __tests__/core/scanner.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from '../../src/core/scanner';
import { logger } from '../../src/utils/logger';
import * as gitModule from '../../src/utils/git';

// ⚠️ IMPORTANTE: MOCKEAR TODAS LAS DEPENDENCIAS
jest.mock('fs');
jest.mock('simple-git');
jest.mock('../../src/utils/git');
jest.mock('../../src/utils/logger');

describe('Scanner', () => {
  let scanner: Scanner;

  beforeEach(() => {
    jest.clearAllMocks();
    scanner = new Scanner();

    // Mock filesystem - simula estructura de directorios
    (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
      if (dirPath === '/test/projects') {
        return ['api', 'web', 'worker', '.cache', '.git'];
      }
      return [];
    });

    // Mock existsSync - simula qué carpetas contienen .git
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath.includes('api') || filePath.includes('web') || filePath.includes('worker');
    });

    // Mock readFileSync - simula leer .devops-custom.json
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('api') && filePath.includes('.devops-custom.json')) {
        return JSON.stringify({
          branch: 'main',
          buildCommand: 'yarn build',
          restartCommand: 'pm2 restart api',
        });
      }
      return null;
    });

    // Mock git - simula extraer remote URL
    (gitModule.getRemoteUrl as jest.Mock).mockResolvedValue('https://github.com/user/api.git');
  });

  describe('scan()', () => {
    it('should find all repositories recursively', async () => {
      const repos = await scanner.scan('/test/projects');

      // Aserciones
      expect(repos).toHaveLength(3); // api, web, worker (sin .cache, .git)
      expect(repos.map(r => r.name)).toEqual(['api', 'web', 'worker']);
    });

    it('should filter hidden folders starting with dot', async () => {
      const repos = await scanner.scan('/test/projects');

      repos.forEach(repo => {
        expect(repo.path).not.toMatch(/\/\./); // No path contiene /.
      });

      // Verificar que fs.readdirSync fue llamado
      expect(fs.readdirSync).toHaveBeenCalledWith('/test/projects');
    });

    it('should load .devops-custom.json config if exists', async () => {
      const repos = await scanner.scan('/test/projects');

      // El repo 'api' debe tener config
      const apiRepo = repos.find(r => r.name === 'api');
      expect(apiRepo.config).toBeDefined();
      expect(apiRepo.config.buildCommand).toBe('yarn build');

      // Los otros no tienen config
      const webRepo = repos.find(r => r.name === 'web');
      expect(webRepo.config).toBeUndefined();
    });

    it('should extract remote origin URL for each repo', async () => {
      const repos = await scanner.scan('/test/projects');

      repos.forEach(repo => {
        expect(repo.remoteUrl).toBe('https://github.com/user/api.git');
        expect(gitModule.getRemoteUrl).toHaveBeenCalledWith(repo.path);
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock error en git
      (gitModule.getRemoteUrl as jest.Mock).mockRejectedValue(
        new Error('Git not found')
      );

      const repos = await scanner.scan('/test/projects');

      // Debe retornar repos pero marcar error
      expect(repos.length).toBeGreaterThan(0);
      expect(repos.some(r => r.error)).toBe(true); // Al menos uno con error
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
```

### Paso 3: Ejecutar el test (aún falla, está bien)
```bash
cd ~/dev/devops-custom
yarn test -- __tests__/core/scanner.test.ts

# Output esperado:
# FAIL __tests__/core/scanner.test.ts
# ● Scanner › should find all repositories recursively
#   TypeError: scanner.scan is not a function
#
# (expected - aún no implementaste)
```

### Paso 4: Implementar el código
```typescript
// src/core/scanner.ts
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from '../types';
import { logger } from './logger';
import * as gitUtils from '../utils/git';

export class Scanner {
  async scan(reposRoot: string): Promise<Repository[]> {
    const repos: Repository[] = [];

    try {
      // Leer directorios en reposRoot
      const dirs = fs.readdirSync(reposRoot)
        .filter(dir => !dir.startsWith('.')); // Filtrar ocultas AQUÍ

      for (const dir of dirs) {
        const dirPath = path.join(reposRoot, dir);
        const gitPath = path.join(dirPath, '.git');

        // Verificar si tiene .git
        if (fs.existsSync(gitPath)) {
          logger.debug(`Found git repo at ${dirPath}`);

          try {
            // Extraer remote URL
            const remoteUrl = await gitUtils.getRemoteUrl(dirPath);

            // Leer config si existe
            let config: any = undefined;
            const configPath = path.join(dirPath, '.devops-custom.json');
            if (fs.existsSync(configPath)) {
              const configContent = fs.readFileSync(configPath, 'utf-8');
              config = JSON.parse(configContent);
            }

            repos.push({
              path: dirPath,
              name: dir,
              remoteUrl,
              branch: config?.branch || 'main',
              status: 'idle',
              config,
            });
          } catch (err) {
            logger.error(`Error processing repo ${dir}:`, err);
            repos.push({
              path: dirPath,
              name: dir,
              remoteUrl: '',
              branch: 'main',
              status: 'error',
              error: (err as Error).message,
            });
          }
        }
      }

      logger.info(`Scanner found ${repos.length} repositories`);
      return repos;
    } catch (err) {
      logger.error('Scanner error:', err);
      throw err;
    }
  }
}

export const scanner = new Scanner();
```

### Paso 5: Ejecutar test nuevamente
```bash
yarn test -- __tests__/core/scanner.test.ts

# Output esperado:
# PASS __tests__/core/scanner.test.ts
#   Scanner
#     scan()
#       ✓ should find all repositories recursively
#       ✓ should filter hidden folders starting with dot
#       ✓ should load .devops-custom.json config if exists
#       ✓ should extract remote origin URL for each repo
#       ✓ should handle errors gracefully
#
# Tests: 5 passed, 5 total
```

### Paso 6: Verificar cobertura
```bash
yarn test -- __tests__/core/scanner.test.ts --coverage

# Output esperado:
# File      | % Stmts | % Branch | % Funcs | % Lines |
# ----------+---------+----------+---------+---------|
# scanner.ts|  100   |   100    |  100    |  100    |
```

### ✅ LISTO: Scanner implementado + testeado + mockeado

---

## FASE 2: IMPLEMENTAR `git.ts`

### Paso 1: Leer TODOs
```typescript
// src/utils/git.ts
// TODO: simple-git wrappers
// - fetch(repoPath): git fetch --all --prune
// - getRemoteUrl(repoPath): extract origin URL
// - pull(repoPath): git pull
// - hasChanges(repoPath, branch): use git rev-list
// - getCurrentBranch(repoPath): get current branch
```

### Paso 2: Escribir TEST (con mocks)
```typescript
// __tests__/utils/git.test.ts
import { simpleGit } from 'simple-git';
import * as gitUtils from '../../src/utils/git';
import { logger } from '../../src/utils/logger';

jest.mock('simple-git');
jest.mock('../../src/utils/logger');

describe('Git Utilities', () => {
  let mockGit: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock de SimpleGit
    mockGit = {
      fetch: jest.fn().mockResolvedValue({}),
      pull: jest.fn().mockResolvedValue({}),
      getRemotes: jest.fn().mockResolvedValue([
        {
          name: 'origin',
          refs: { fetch: 'https://github.com/user/repo.git' }
        }
      ]),
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

  describe('getRemoteUrl()', () => {
    it('should extract origin URL from git remotes', async () => {
      const url = await gitUtils.getRemoteUrl('/test/repo');

      expect(url).toBe('https://github.com/user/repo.git');
      expect(simpleGit).toHaveBeenCalledWith('/test/repo');
      expect(mockGit.getRemotes).toHaveBeenCalled();
    });
  });

  describe('fetch()', () => {
    it('should execute git fetch --all --prune', async () => {
      await gitUtils.fetch('/test/repo');

      expect(mockGit.fetch).toHaveBeenCalledWith('--all', '--prune');
    });

    it('should handle fetch errors', async () => {
      mockGit.fetch.mockRejectedValue(new Error('Network error'));

      await expect(gitUtils.fetch('/test/repo')).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('hasChanges()', () => {
    it('should detect changes using git rev-list', async () => {
      mockGit.revList.mockResolvedValue(['abc123', 'def456']);

      const hasChanges = await gitUtils.hasChanges('/test/repo', 'main');

      expect(hasChanges).toBe(true);
      expect(mockGit.revList).toHaveBeenCalledWith(
        ['HEAD..origin/main', '--count']
      );
    });

    it('should return false when no changes', async () => {
      mockGit.revList.mockResolvedValue([]);

      const hasChanges = await gitUtils.hasChanges('/test/repo', 'main');

      expect(hasChanges).toBe(false);
    });
  });
});
```

### Paso 3-6: Implementar, testear, verificar

---

## FASE 3: IMPLEMENTAR `worker.ts`

### Test con mocks de TODAS las dependencias
```typescript
// __tests__/core/worker.test.ts
import { Worker } from '../../src/core/worker';
import * as gitUtils from '../../src/utils/git';
import * as pm2Utils from '../../src/utils/pm2';
import * as lockUtils from '../../src/utils/lock';
import { logger } from '../../src/utils/logger';
import { exec } from 'child_process';

jest.mock('../../src/utils/git');
jest.mock('../../src/utils/pm2');
jest.mock('../../src/utils/lock');
jest.mock('../../src/utils/logger');
jest.mock('child_process');

describe('Worker', () => {
  let worker: Worker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new Worker();

    // Defaults de mocks
    (gitUtils.pull as jest.Mock).mockResolvedValue(true);
    (gitUtils.fetch as jest.Mock).mockResolvedValue(true);
    (pm2Utils.restart as jest.Mock).mockResolvedValue({ success: true });
    (lockUtils.acquire as jest.Mock).mockResolvedValue(true);
    (lockUtils.release as jest.Mock).mockResolvedValue(true);
    (lockUtils.isLocked as jest.Mock).mockReturnValue(false);
  });

  describe('update()', () => {
    it('should acquire lock, update, and release lock', async () => {
      const repo = { path: '/test/repo', name: 'test' };

      const result = await worker.update(repo);

      // Verificar secuencia de llamadas
      expect(lockUtils.isLocked).toHaveBeenCalledWith(repo.path);
      expect(lockUtils.acquire).toHaveBeenCalledWith(repo.path);
      expect(gitUtils.pull).toHaveBeenCalledWith(repo.path);
      expect(lockUtils.release).toHaveBeenCalledWith(repo.path);
      expect(result.success).toBe(true);
    });

    it('should not update if repo is locked', async () => {
      const repo = { path: '/test/repo', name: 'test' };
      (lockUtils.isLocked as jest.Mock).mockReturnValue(true);

      const result = await worker.update(repo);

      expect(result.success).toBe(false);
      expect(gitUtils.pull).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle git pull errors', async () => {
      const repo = { path: '/test/repo', name: 'test' };
      (gitUtils.pull as jest.Mock).mockRejectedValue(
        new Error('Conflict in files')
      );

      const result = await worker.update(repo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conflict');
      expect(logger.error).toHaveBeenCalled();
      // Lock debe ser liberado aunque haya error
      expect(lockUtils.release).toHaveBeenCalled();
    });
  });
});
```

---

## CHECKLIST: DESPUÉS DE CADA IMPLEMENTACIÓN

✅ **¿Test pasando?**
```bash
yarn test -- __tests__/core/scanner.test.ts
# PASS
```

✅ **¿Cobertura > 90%?**
```bash
yarn test -- __tests__/core/scanner.test.ts --coverage
# Statements: 100% ...
```

✅ **¿Todos los mocks están?**
- [ ] `jest.mock('fs')` si usas fs
- [ ] `jest.mock('simple-git')` si usas git
- [ ] `jest.mock('../../src/utils/git')` si llamas funciones locales
- [ ] `jest.mock('../../src/utils/logger')` para verificar logs

✅ **¿Antes de commit?**
```bash
# Ejecuta suite completa
yarn test

# Verifica cobertura total
yarn test --coverage
```

---

## REGLA DE ORO

> **Si tu test usa:** `fs.readFileSync`, `exec()`, `simpleGit()`, `pm2.restart()`, `process.env`...
>
> **Entonces DEBES mockear ese módulo/dependencia**
>
> Nunca dejes de mockear porque "funcione una vez". Será frágil.

---

## INTEGRACIÓN EN TU FLUJO

```
Mientras implementas scanner.ts:
1. Leo el TODO
2. Escribo 5 tests que REQUIEREN mocks de fs, simple-git, logger
3. Ejecuto los tests (fallan)
4. Implemento scanner.ts
5. Ejecuto tests (pasan)
6. Verifico cobertura (90%+)
7. Commit: "feat: implement scanner with tests and mocks"

Mientras implementas git.ts:
1. Leo TODO
2. Escribo tests que mockean simple-git, logger
3. ... (mismo proceso)

Y así sucesivamente.
```

---

## BENEFICIOS DE MOCKEAR DESDE EL INICIO

✅ Tests rápidos (< 5 segundos para toda la suite)
✅ No necesitas git real, PM2 real, directorios reales
✅ Tests determinísticos (nunca "flaky")
✅ Compatible con CI/CD (GitHub Actions, etc)
✅ Fácil reproducir bugs (el mock muestra exactamente qué se llamó)
✅ Fácil testear casos error (`.mockRejectedValue(error)`)

---

## DEBUG: Si un test falla

```typescript
// Agrega console.log en el test
expect(mockGit.fetch).toHaveBeenCalledWith('--all', '--prune');

// O usa toMatchInlineSnapshot
expect(gitUtils.fetch).toHaveBeenCalledWith(
  expect.objectContaining({ path: '/test/repo' })
);

// O imprime los calls
console.log('fetch was called with:', mockGit.fetch.mock.calls);
```

---

**¡Listo para implementar con confianza!** 🧪🚀
