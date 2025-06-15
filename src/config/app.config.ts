// src/config/app.config.ts
import ConfigService from './config.class'

const configService = new ConfigService()

export const appConfig = {
    port: configService.get('PORT') || 3001,
    // configService.get('NODE_ENV') ||
    env: 'development',

    // Пути
    // process.env.TEMP_DIR ||
    tempDir: 'src/temp',
    uploadsDir: 'src/temp/uploads',
    outputsDir: 'src/temp/outputs',

    // Лимиты
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxMessageLength: 10000, // символов

    // Безопасность
    encryptionAlgorithm: 'aes-256-cbc',
    saltRounds: 10,

    // Логирование
    // process.env.LOG_LEVEL ||
    logLevel: 'info',
    logDir: 'logs',
}
