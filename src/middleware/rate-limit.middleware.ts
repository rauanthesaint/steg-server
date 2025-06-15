// src/middleware/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

export const rateLimitMiddleware = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 20, // Максимум 20 запросов на окно
    message: {
        error: 'Too many requests, please try again later',
        retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.ip || 'unknown'
    },
    skip: (req: Request) => {
        // Пропускаем health check
        return req.path === '/health'
    },
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests, please try again later',
        })
    },
})

// Более строгий лимит для операций стеганографии
export const steganographyRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 5, // 5 операций в минуту
    message: {
        error: 'Steganography rate limit exceeded',
        retryAfter: '1 minute',
    },
})
