// src/routes/steganography.routes.ts
import { Router } from 'express'
import {
    embedMessage,
    extractMessage,
    getSupportedAlgorithms,
    getAlgorithmRecommendation,
    checkCapacity,
} from '../controllers/steganography.controller'
import { fileUploadMiddleware } from '../middleware/file-upload.middleware'
import { steganographyRateLimit } from '../middleware/rate-limit.middleware'

const router = Router()

/**
 * POST /api/steganography/embed
 * Встраивание сообщения в файл
 */
router.post(
    '/embed',
    steganographyRateLimit,
    fileUploadMiddleware,
    embedMessage
)

/**
 * POST /api/steganography/extract
 * Извлечение сообщения из файла
 */
router.post(
    '/extract',
    steganographyRateLimit,
    fileUploadMiddleware,
    extractMessage
)

/**
 * GET /api/steganography/algorithms
 * Получение списка поддерживаемых алгоритмов
 * Query params: ?format=image/png
 */
router.get('/algorithms', getSupportedAlgorithms)

/**
 * GET /api/steganography/recommend
 * Получение рекомендации по алгоритму
 * Query params: ?mimetype=image/png&messageLength=100
 */
router.get('/recommend', getAlgorithmRecommendation)

/**
 * POST /api/steganography/capacity
 * Проверка вместимости файла
 */
router.post('/capacity', fileUploadMiddleware, checkCapacity)

export { router as steganographyRoutes }
