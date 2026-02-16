/**
 * iWorkr Structured Logger
 *
 * Production-ready logging utility that outputs structured JSON in production
 * and human-readable format in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    digest?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL = process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  const prefix = {
    debug: "\x1b[36m[DEBUG]\x1b[0m",
    info: "\x1b[32m[INFO]\x1b[0m",
    warn: "\x1b[33m[WARN]\x1b[0m",
    error: "\x1b[31m[ERROR]\x1b[0m",
  }[entry.level];

  const ctx = entry.context ? ` \x1b[90m(${entry.context})\x1b[0m` : "";
  return `${prefix}${ctx} ${entry.message}`;
}

function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>, error?: Error) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };

  if (error) {
    entry.error = {
      message: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
      digest: (error as any).digest,
    };
  }

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted, data || "");
      break;
    case "warn":
      console.warn(formatted, data || "");
      break;
    case "debug":
      console.debug(formatted, data || "");
      break;
    default:
      console.log(formatted, data || "");
  }
}

export const logger = {
  debug: (message: string, context?: string, data?: Record<string, unknown>) =>
    log("debug", message, context, data),

  info: (message: string, context?: string, data?: Record<string, unknown>) =>
    log("info", message, context, data),

  warn: (message: string, context?: string, data?: Record<string, unknown>) =>
    log("warn", message, context, data),

  error: (message: string, context?: string, error?: Error, data?: Record<string, unknown>) =>
    log("error", message, context, data, error),

  /** Log an API request */
  request: (method: string, path: string, status: number, durationMs: number) =>
    log("info", `${method} ${path} → ${status} (${durationMs}ms)`, "api"),

  /** Log an automation event */
  automation: (message: string, data?: Record<string, unknown>) =>
    log("info", message, "automation", data),
};
