// src/utils/logger.ts
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

interface LogEntry {
    timestamp: string
    level: string
    message: string
    meta?: Record<string, any>
}

class Logger {
    private logLevel: LogLevel = LogLevel.INFO
    private logDir: string = 'logs'

    constructor() {
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true })
        }
    }

    private log(
        level: LogLevel,
        message: string,
        meta?: Record<string, any>
    ): void {
        if (level > this.logLevel) return

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message,
            meta,
        }

        // Console output
        console.log(this.formatConsoleMessage(entry))

        // File output
        this.writeToFile(entry)
    }

    private formatConsoleMessage(entry: LogEntry): string {
        const { timestamp, level, message, meta } = entry
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
        return `[${timestamp}] ${level}: ${message}${metaStr}`
    }

    private writeToFile(entry: LogEntry): void {
        const date = new Date().toISOString().split('T')[0]
        const filename = join(this.logDir, `app-${date}.log`)
        const logLine = JSON.stringify(entry) + '\n'

        const stream = createWriteStream(filename, { flags: 'a' })
        stream.write(logLine)
        stream.end()
    }

    info(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, meta)
    }

    warn(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, meta)
    }

    error(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, meta)
    }

    debug(message: string, meta?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, meta)
    }
}

export const logger = new Logger()
