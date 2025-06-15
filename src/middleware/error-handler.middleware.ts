// src/middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { handleSteganographyError } from '../utils/error-handler'
import { logger } from '../utils/logger'
import { appConfig } from '../config/app.config'
export const errorHandlerMiddleware = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Логирование ошибки
    logger.error('Request failed', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        environment: appConfig.env,
    })

    // Обработка специфичных ошибок стеганографии
    const { message, code } = handleSteganographyError(error)

    // Определение статус кода
    let statusCode = 500

    if (code === 'INSUFFICIENT_CAPACITY' || code === 'UNSUPPORTED_FORMAT') {
        statusCode = 400
    } else if (code === 'CORRUPTED_DATA') {
        statusCode = 422
    }

    // Ответ клиенту
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code,
            timestamp: new Date().toISOString(),
        },
    })
}

// Middleware для обработки 404
export const notFoundMiddleware = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: {
            message: 'Route not found',
            code: 'NOT_FOUND',
        },
    })
}
