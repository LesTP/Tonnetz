/**
 * Debug logging for the integration module (Phase 7c).
 *
 * Provides a structured logger that is active only in development builds.
 * In production (`import.meta.env.DEV === false`), all log calls are
 * no-ops that get tree-shaken by the bundler.
 *
 * Usage:
 *   import { log } from "./logger.js";
 *   log.info("startup", "App ready", { state: "idle" });
 *   log.warn("pipeline", "Invalid chord", { symbol: "Xaug7" });
 *   log.error("audio", "Init failed", error);
 *
 * Log format: `[Tonnetz:<tag>] <message>` followed by optional data.
 */

const PREFIX = "[Tonnetz";

type LogLevel = "info" | "warn" | "error";

function noop(): void {}

interface Logger {
  info(tag: string, message: string, ...data: unknown[]): void;
  warn(tag: string, message: string, ...data: unknown[]): void;
  error(tag: string, message: string, ...data: unknown[]): void;
}

function createDevLogger(): Logger {
  function emit(
    level: LogLevel,
    tag: string,
    message: string,
    data: unknown[],
  ): void {
    const label = `${PREFIX}:${tag}] ${message}`;
    if (data.length > 0) {
      console[level](label, ...data);
    } else {
      console[level](label);
    }
  }

  return {
    info: (tag, message, ...data) => emit("info", tag, message, data),
    warn: (tag, message, ...data) => emit("warn", tag, message, data),
    error: (tag, message, ...data) => emit("error", tag, message, data),
  };
}

function createProdLogger(): Logger {
  return {
    info: noop,
    warn: noop,
    error: noop,
  };
}

/**
 * Structured logger instance.
 *
 * Active in dev builds (`import.meta.env.DEV === true`), no-op in production.
 * Vite tree-shakes the dev logger in production builds.
 */
export const log: Logger = import.meta.env.DEV
  ? createDevLogger()
  : createProdLogger();
