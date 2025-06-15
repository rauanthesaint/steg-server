// src/controllers/steganography.controller.ts
import { Request, Response } from 'express'
import { SteganographyService } from '../services/steganography.service'
import { ValidationService } from '../services/validation.service'
import { AlgorithmSelectorService } from '../services/algorithm-selector.service'
import { FileProcessorService } from '../services/file-processor.service'
import { logger } from '../utils/logger'
import { handleSteganographyError } from '../utils/error-handler'

import { AlgorithmFactory } from '../algorithms/base/algorithm.factory'
interface EmbedRequest {
    message: string
    algorithm?: string
    password?: string
}

interface ExtractRequest {
    algorithm?: string
    password?: string
}

export class SteganographyController {
    private steganographyService = new SteganographyService()
    private validationService = new ValidationService()
    private algorithmSelector = new AlgorithmSelectorService()
    private fileProcessor = new FileProcessorService()

    /**
     * Встраивание сообщения в файл
     */
    embedMessage = async (req: Request, res: Response): Promise<void> => {
        try {
            const {
                message,
                algorithm = 'auto',
                password,
            }: EmbedRequest = req.body
            const file = req.file

            // 🔍 ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ
            console.log('=== EMBED REQUEST DEBUG ===')
            console.log('Request body:', req.body)
            console.log('Password received:', password)
            console.log('Password type:', typeof password)
            console.log('Password length:', password?.length)
            console.log('Has password:', !!password)
            console.log('===============================')

            if (!file) {
                res.status(400).json({
                    success: false,
                    error: { message: 'No file uploaded', code: 'NO_FILE' },
                })
                return
            }

            logger.info('Embed request received', {
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                algorithm,
                messageLength: message?.length,
            })

            // Обработка файла
            const processedFile = await this.fileProcessor.processUploadedFile(
                file.path,
                file.originalname,
                file.mimetype
            )

            // Автовыбор алгоритма если не указан
            let selectedAlgorithm = algorithm
            if (algorithm === 'auto') {
                const recommendation =
                    this.algorithmSelector.selectBestAlgorithm(
                        file.mimetype,
                        message?.length
                    )
                selectedAlgorithm = recommendation.algorithm
            }

            // Валидация запроса
            const validation =
                await this.validationService.validateEmbedRequest({
                    filePath: file.path,
                    mimetype: file.mimetype,
                    algorithm: selectedAlgorithm,
                    message,
                    password,
                })

            if (!validation.isValid) {
                await this.fileProcessor.cleanupFile(file.path)
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: validation.errors,
                    },
                    warnings: validation.warnings,
                })
                return
            }

            // Встраивание сообщения
            const result = await this.steganographyService.embedMessage({
                filePath: file.path,
                mimetype: file.mimetype,
                algorithm: selectedAlgorithm,
                message,
                password,
            })

            // Сохранение результата
            const outputPath = await this.fileProcessor.saveProcessedFile(
                result.data as Buffer,
                file.originalname
            )

            // Очистка временного файла
            await this.fileProcessor.cleanupFile(file.path)

            logger.info('Embed operation completed successfully', {
                algorithm: selectedAlgorithm,
                outputSize: (result.data as Buffer).length,
                processingTime: result.metadata?.processingTime,
            })

            res.json({
                success: true,
                data: {
                    file: {
                        content: (result.data as Buffer).toString('base64'),
                        mimetype: 'image/png',
                        filename: `steg_${file.originalname}`,
                    },
                    outputPath,
                    algorithm: selectedAlgorithm,
                    fileSize: (result.data as Buffer).length,
                    processingTime: result.metadata?.processingTime,
                },
                warnings: validation.warnings,
                recommendations:
                    this.validationService.getOptimizationRecommendations(
                        processedFile.size,
                        message.length,
                        file.mimetype
                    ),
            })
        } catch (error) {
            // Очистка файла при ошибке
            if (req.file?.path) {
                await this.fileProcessor.cleanupFile(req.file.path)
            }

            const { message, code } = handleSteganographyError(error)
            const statusCode = this.getStatusCode(code)

            logger.error('Embed operation failed', {
                error: message,
                code,
                file: req.file?.originalname,
            })

            res.status(statusCode).json({
                success: false,
                error: { message, code },
            })
        }
    }

    /**
     * Извлечение сообщения из файла
     */
    extractMessage = async (req: Request, res: Response): Promise<void> => {
        try {
            const { algorithm = 'lsb', password }: ExtractRequest = req.body
            const file = req.file

            if (!file) {
                res.status(400).json({
                    success: false,
                    error: { message: 'No file uploaded', code: 'NO_FILE' },
                })
                return
            }

            logger.info('Extract request received', {
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                algorithm,
            })

            // Обработка файла
            await this.fileProcessor.processUploadedFile(
                file.path,
                file.originalname,
                file.mimetype
            )

            // Валидация запроса
            const validation =
                await this.validationService.validateExtractRequest({
                    filePath: file.path,
                    mimetype: file.mimetype,
                    algorithm,
                    password,
                })

            if (!validation.isValid) {
                await this.fileProcessor.cleanupFile(file.path)
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: validation.errors,
                    },
                    warnings: validation.warnings,
                })
                return
            }

            // Извлечение сообщения
            const result = await this.steganographyService.extractMessage({
                filePath: file.path,
                mimetype: file.mimetype,
                algorithm,
                password,
            })

            // Очистка временного файла
            await this.fileProcessor.cleanupFile(file.path)

            logger.info('Extract operation completed successfully', {
                algorithm,
                messageLength: (result.data as string).length,
                processingTime: result.metadata?.processingTime,
            })

            res.json({
                success: true,
                data: {
                    message: result.data,
                    algorithm,
                    messageLength: (result.data as string).length,
                    processingTime: result.metadata?.processingTime,
                },
                warnings: validation.warnings,
            })
        } catch (error) {
            // Очистка файла при ошибке
            if (req.file?.path) {
                await this.fileProcessor.cleanupFile(req.file.path)
            }

            const { message, code } = handleSteganographyError(error)
            const statusCode = this.getStatusCode(code)

            logger.error('Extract operation failed', {
                error: message,
                code,
                file: req.file?.originalname,
            })

            res.status(statusCode).json({
                success: false,
                error: { message, code },
            })
        }
    }

    /**
     * Получение информации о поддерживаемых алгоритмах
     */
    getSupportedAlgorithms = (req: Request, res: Response): void => {
        try {
            const { format } = req.query

            let algorithms: string[]
            if (format && typeof format === 'string') {
                algorithms =
                    this.algorithmSelector.getAvailableAlgorithms(format)
            } else {
                algorithms =
                    this.algorithmSelector.getAvailableAlgorithms('image/png') // default
            }

            res.json({
                success: true,
                data: {
                    algorithms,
                    format: format || 'all',
                },
            })
        } catch (error) {
            const { message, code } = handleSteganographyError(error)

            res.status(400).json({
                success: false,
                error: { message, code },
            })
        }
    }

    /**
     * Получение рекомендаций по алгоритму
     */
    getAlgorithmRecommendation = (req: Request, res: Response): void => {
        try {
            const { mimetype, messageLength } = req.query

            if (!mimetype || typeof mimetype !== 'string') {
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'Mimetype is required',
                        code: 'MISSING_PARAMETER',
                    },
                })
                return
            }

            const msgLength = messageLength
                ? parseInt(messageLength as string)
                : undefined
            const recommendation = this.algorithmSelector.selectBestAlgorithm(
                mimetype,
                msgLength
            )

            res.json({
                success: true,
                data: recommendation,
            })
        } catch (error) {
            const { message, code } = handleSteganographyError(error)

            res.status(400).json({
                success: false,
                error: { message, code },
            })
        }
    }

    /**
     * Проверка вместимости файла
     */
    checkCapacity = async (req: Request, res: Response): Promise<void> => {
        try {
            const file = req.file
            const { algorithm = 'lsb', messageLength } = req.body

            if (!file) {
                res.status(400).json({
                    success: false,
                    error: { message: 'No file uploaded', code: 'NO_FILE' },
                })
                return
            }

            if (!messageLength || isNaN(parseInt(messageLength))) {
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'Message length is required',
                        code: 'MISSING_PARAMETER',
                    },
                })
                return
            }

            // Обработка файла
            await this.fileProcessor.processUploadedFile(
                file.path,
                file.originalname,
                file.mimetype
            )

            // Проверка вместимости через сервис стеганографии
            const algorithmInstance = AlgorithmFactory.getAlgorithm(algorithm)
            const canFit = await algorithmInstance.checkCapacity(
                file.path,
                parseInt(messageLength),
                file.mimetype
            )

            // Очистка временного файла
            await this.fileProcessor.cleanupFile(file.path)

            res.json({
                success: true,
                data: {
                    canFit,
                    maxCapacity: Math.floor(file.size * 0.75), // примерная оценка
                    requestedLength: parseInt(messageLength),
                    algorithm,
                },
            })
        } catch (error) {
            // Очистка файла при ошибке
            if (req.file?.path) {
                await this.fileProcessor.cleanupFile(req.file.path)
            }

            const { message, code } = handleSteganographyError(error)

            res.status(400).json({
                success: false,
                error: { message, code },
            })
        }
    }

    private getStatusCode(errorCode: string): number {
        switch (errorCode) {
            case 'INSUFFICIENT_CAPACITY':
            case 'UNSUPPORTED_FORMAT':
            case 'VALIDATION_ERROR':
                return 400
            case 'CORRUPTED_DATA':
                return 422
            default:
                return 500
        }
    }
}

// Экспорт экземпляра контроллера
const steganographyController = new SteganographyController()

export const embedMessage = steganographyController.embedMessage
export const extractMessage = steganographyController.extractMessage
export const getSupportedAlgorithms =
    steganographyController.getSupportedAlgorithms
export const getAlgorithmRecommendation =
    steganographyController.getAlgorithmRecommendation
export const checkCapacity = steganographyController.checkCapacity
