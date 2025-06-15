// src/routes/index.ts
import { Router } from 'express'
import { steganographyRoutes } from './steganography.routes'

import { rateLimitMiddleware } from '../middleware/rate-limit.middleware'
import { notFoundMiddleware } from '../middleware/error-handler.middleware'

const router = Router()

/**
 * API версионирование
 */
const API_VERSION = '/api/v1'

/**
 * Health checks (без rate limiting)
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
    })
})

/**
 * Основные API роуты с rate limiting
 */
router.use(
    `${API_VERSION}/steganography`,
    rateLimitMiddleware,
    steganographyRoutes
)

/**
 * API информация
 */
router.get(`${API_VERSION}`, (req, res) => {
    res.json({
        name: 'Steganography API',
        version: '1.0.0',
        description:
            'API for steganographic operations on images and audio files',
        endpoints: {
            health: '/health',
            steganography: `${API_VERSION}/steganography`,
            documentation: `${API_VERSION}/docs`,
        },
        supportedFormats: {
            image: ['image/png', 'image/bmp', 'image/tiff'],
            audio: ['audio/wav'],
        },
        supportedAlgorithms: {
            image: ['lsb'],
            audio: ['lsb-audio'],
        },
        features: [
            'LSB steganography for images',
            'LSB steganography for audio',
            'AES encryption support',
            'Automatic format detection',
            'Capacity checking',
            'Algorithm recommendations',
        ],
    })
})

/**
 * API документация endpoint (заглушка)
 */
// router.get(`${API_VERSION}/docs`, (req, res) => {
//     res.json({
//         message: 'API Documentation',
//         swagger: `${req.protocol}://${req.get('host')}${API_VERSION}/swagger`,
//         postman: `${req.protocol}://${req.get('host')}${API_VERSION}/postman`,
//     })
// })

/**
 * 404 для неизвестных роутов
 */
router.use('*', notFoundMiddleware)

export { router as mainRoutes }
