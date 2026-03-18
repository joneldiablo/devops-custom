/**
 * Repository poller core
 * Periodically checks for updates and triggers worker
 *
 * SEQUENTIAL DESIGN: Updates are processed one at a time
 * Never runs builds in parallel to avoid resource contention
 */

import { Scanner } from "./scanner";
import { Worker } from "./worker";
import { Repository, PollerOptions } from "../types";
import { logger } from "../utils/logger";

export class Poller {
  private scanner: Scanner;
  private worker: Worker;
  private running: boolean = false;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor() {
    this.scanner = new Scanner();
    this.worker = new Worker();
  }

  /**
   * Start the polling daemon
   */
  async start(options: PollerOptions): Promise<void> {
    if (this.running) {
      logger.warn("Poller already running");
      return;
    }

    this.running = true;
    logger.info("Starting poller daemon");
    logger.info(`Poll interval: ${options.pollInterval}ms`);
    logger.info(`Repos root: ${options.reposRoot}`);

    // Initial scan
    await this.scanner.scan(options.reposRoot);

    // Run first poll immediately
    await this.pollCycle(options);
    this.scheduleNextPoll(options);
  }

  /**
   * Schedule next poll only after current one has fully completed.
   * Prevents overlapping cycles when updates take longer than pollInterval.
   */
  private scheduleNextPoll(options: PollerOptions): void {
    if (!this.running) return;
    clearTimeout(this.timeoutId || 0);

    this.timeoutId = setTimeout(async () => {
      await this.pollCycle(options);
      this.scheduleNextPoll(options);
    }, options.pollInterval);
  }

  /**
   * Single poll cycle
   * SEQUENTIAL: processes repos one at a time
   */
  private async pollCycle(options: PollerOptions): Promise<void> {
    try {
      const repos = this.scanner.getRepos();

      if (repos.length === 0) {
        logger.debug("No repositories found, rescanning...");
        await this.scanner.scan(options.reposRoot);
        return;
      }

      logger.debug(`Poll cycle starting: ${repos.length} repos`);
      logger.info("\n===== FETCHING :: ALL REPOS =====");

      // CRITICAL: Sequential loop - one repo at a time
      for (const repo of repos) {
        if (!repo) continue;

        try {
          logger.debug(`Checking ${repo.name}`);
          const result = await this.worker.updateRepository(repo);

          if (result.success && result.message !== "No changes detected") {
            logger.info(`Updated ${repo.name}: ${result.message}`);
          }
        } catch (error) {
          logger.error(`Error updating ${repo.name}: ${error}`);
        }
      }

      logger.debug("Poll cycle completed");
    } catch (error) {
      logger.error(`Poller cycle error: ${error}`);
    }
  }

  /**
   * Stop the polling daemon
   */
  stop(): void {
    if (!this.running) {
      logger.warn("Poller not running");
      return;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.running = false;
    logger.info("Poller daemon stopped");
  }

  /**
   * Check if poller is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current repositories
   */
  getRepositories(): Repository[] {
    return this.scanner.getRepos();
  }

  /**
   * Manual rescan
   */
  async rescan(reposRoot: string): Promise<Repository[]> {
    return await this.scanner.scan(reposRoot, true);
  }
}
