/**
 * Core types and interfaces for devops-custom
 */

export interface Repository {
  path: string;
  name: string;
  remoteUrl: string;
  branch: string;
  lastChecked?: Date;
  lastUpdated?: Date;
  status: 'pending' | 'updating' | 'success' | 'error' | 'idle';
  error?: string;
}

export interface DiabliteConfig {
  branch?: string;
  build?: string;
  restart?: string;
  autoUpdate?: boolean;
  enabled?: boolean;
}

export interface PollerOptions {
  pollInterval: number; // milliseconds
  reposRoot: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface UpdateResult {
  success: boolean;
  message: string;
  repository: string;
  timestamp: Date;
  error?: Error;
}

export interface DaemonConfig {
  repos: Repository[];
  pollInterval: number;
  reposRoot: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
