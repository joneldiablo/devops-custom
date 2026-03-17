/**
 * Environment availability test for build subprocess.
 * Verifies node/npm/yarn are available within the spawned build shell.
 */

import { Worker } from '../../src/core/worker';

describe('Worker build environment', () => {
  let worker: Worker;

  beforeEach(() => {
    worker = new Worker();
  });

  it('should have access to node, npm and yarn in build subprocess', async () => {
    jest.setTimeout(20000);
    const result = await (worker as any).executeBuildCommand(
      'node -v && npm -v && yarn -v',
      process.cwd()
    );

    expect(result).toBe(true);
  });
});

