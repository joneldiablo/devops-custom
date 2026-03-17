/**
 * Timing-focused tests for build subprocess execution.
 * Uses real child_process timing behavior (no mocks).
 */

import { Worker } from '../../src/core/worker';

describe('Worker build timing', () => {
  let worker: Worker;
  jest.setTimeout(30000);

  beforeEach(() => {
    worker = new Worker();
  });

  it('should wait until sleep command finishes', async () => {
    const start = process.hrtime.bigint();
    const result = await (worker as any).executeBuildCommand('sleep 10', process.cwd());
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    expect(result).toBe(true);
    expect(elapsedMs).toBeGreaterThanOrEqual(9500);
  });

  it('should still wait even when final status is failure', async () => {
    const start = process.hrtime.bigint();
    const result = await (worker as any).executeBuildCommand(
      'sleep 10; false',
      process.cwd()
    );
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    expect(result).toBe(false);
    expect(elapsedMs).toBeGreaterThanOrEqual(9500);
  });
});
