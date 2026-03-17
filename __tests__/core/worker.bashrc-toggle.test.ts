/**
 * Verifies LOAD_BASHRC toggle behavior in build subprocess execution.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Worker } from '../../src/core/worker';

describe('Worker bashrc toggle', () => {
  const originalBashrcPath = process.env.BASHRC_PATH;
  const originalLoadBashrc = process.env.LOAD_BASHRC;

  afterEach(() => {
    if (originalBashrcPath === undefined) {
      delete process.env.BASHRC_PATH;
    } else {
      process.env.BASHRC_PATH = originalBashrcPath;
    }

    if (originalLoadBashrc === undefined) {
      delete process.env.LOAD_BASHRC;
    } else {
      process.env.LOAD_BASHRC = originalLoadBashrc;
    }
  });

  it('should source ~/.bashrc by default', async () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-bashrc-on-'));
    const bashrcPath = path.join(tempHome, '.bashrc');
    fs.writeFileSync(
      bashrcPath,
      'export TEST_BASHRC_FLAG=loaded\n',
      'utf-8'
    );

    process.env.BASHRC_PATH = bashrcPath;
    delete process.env.LOAD_BASHRC; // default true

    const worker = new Worker();
    const result = await (worker as any).executeBuildCommand(
      'test "$TEST_BASHRC_FLAG" = "loaded"',
      process.cwd()
    );

    expect(result).toBe(true);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('should not source ~/.bashrc when LOAD_BASHRC=false', async () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-bashrc-off-'));
    const bashrcPath = path.join(tempHome, '.bashrc');
    fs.writeFileSync(
      bashrcPath,
      'export TEST_BASHRC_FLAG=loaded\n',
      'utf-8'
    );

    process.env.BASHRC_PATH = bashrcPath;
    process.env.LOAD_BASHRC = 'false';

    const worker = new Worker();
    const result = await (worker as any).executeBuildCommand(
      'test "$TEST_BASHRC_FLAG" = "loaded"',
      process.cwd()
    );

    expect(result).toBe(false);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });
});
