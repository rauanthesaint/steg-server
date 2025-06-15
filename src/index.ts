import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import { mainRoutes } from './routes'
import { errorHandlerMiddleware } from './middleware/error-handler.middleware'
import { appConfig } from './config/app.config'
import { logger } from './utils/logger'
import { promises as fs } from 'fs'

const application: Express = express()
const port = appConfig.port

// Создание необходимых директорий
async function createDirectories() {
    try {
        await fs.mkdir(appConfig.tempDir, { recursive: true })
        await fs.mkdir(appConfig.uploadsDir, { recursive: true })
        await fs.mkdir(appConfig.outputsDir, { recursive: true })
        logger.info('Directories created successfully')
    } catch (error) {
        logger.error('Failed to create directories', {
            error: error instanceof Error ? error.message : 'Unknown error',
        })
    }
}

// Apply CORS middleware
application.use(
    cors({
        origin:
            process.env.NODE_ENV === 'production'
                ? 'https://yourdomain.com'
                : '*',
        credentials: true,
        methods: 'PUT, POST, GET, DELETE, PATCH, OPTIONS',
        allowedHeaders: 'Content-Type, Authorization',
        maxAge: 1800,
    })
)

// Middleware
application.use(express.json({ limit: '10mb' }))
application.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Trust proxy for rate limiting
application.set('trust proxy', 1)

// Логирование входящих запросов
application.use((req: Request, res: Response, next) => {
    logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    })
    next()
})

// Основные роуты
application.use('/', mainRoutes)

// Глобальная обработка ошибок (должна быть последней)
application.use(errorHandlerMiddleware)

// Инициализация сервера
async function startServer() {
    try {
        await createDirectories()

        application.listen(port, () => {
            logger.info(`Server started successfully`, {
                port,
                env: appConfig.env,
                nodeVersion: process.version,
            })
            console.log(`[Server]: Running at http://localhost:${port}`)
            console.log(`[Health]: http://localhost:${port}/health`)
            console.log(`[API]: http://localhost:${port}/api/v1`)
        })
    } catch (error) {
        logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : 'Unknown error',
        })
        process.exit(1)
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully')
    process.exit(0)
})

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully')
    process.exit(0)
})

// Запуск сервера
startServer()
