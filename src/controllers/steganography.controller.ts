// src/controllers/steganography.controller.ts - ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
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

            console.log('=== EMBED REQUEST DEBUG ===')
            console.log('File:', file?.originalname)
            console.log('Mimetype:', file?.mimetype)
            console.log('Algorithm:', algorithm)
            console.log('Message length:', message?.length)
            console.log('Has password:', !!password)
            console.log('==========================')

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

            // Автовыбор алгоритма
            let selectedAlgorithm = algorithm
            if (algorithm === 'auto') {
                if (file.mimetype.startsWith('audio/')) {
                    selectedAlgorithm = 'lsb-audio'
                } else if (file.mimetype.startsWith('image/')) {
                    selectedAlgorithm = 'lsb'
                } else {
                    res.status(400).json({
                        success: false,
                        error: {
                            message: `Unsupported file type: ${file.mimetype}`,
                            code: 'UNSUPPORTED_FORMAT',
                        },
                    })
                    return
                }
            }

            console.log('Selected algorithm:', selectedAlgorithm)

            // Проверка совместимости алгоритма с форматом
            if (
                !AlgorithmFactory.isAlgorithmCompatible(
                    selectedAlgorithm,
                    file.mimetype
                )
            ) {
                res.status(400).json({
                    success: false,
                    error: {
                        message: `Algorithm ${selectedAlgorithm} is not compatible with ${file.mimetype}`,
                        code: 'INCOMPATIBLE_ALGORITHM',
                    },
                })
                return
            }

            // Базовая валидация сообщения
            if (!message || message.length === 0) {
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'Message is required and cannot be empty',
                        code: 'EMPTY_MESSAGE',
                    },
                })
                return
            }

            if (message.length > 10000) {
                // из appConfig.maxMessageLength
                res.status(400).json({
                    success: false,
                    error: {
                        message: `Message too long: ${message.length} chars, max: 10000`,
                        code: 'MESSAGE_TOO_LONG',
                    },
                })
                return
            }

            // Обработка файла (легкая валидация)
            const processedFile = await this.fileProcessor.processUploadedFile(
                file.path,
                file.originalname,
                file.mimetype,
                {
                    validateFormat: false, // Отключаем строгую валидацию формата
                    maxSize: 200 * 1024 * 1024, // 200MB для аудио
                }
            )

            // Проверка вместимости
            try {
                const algorithmInstance =
                    AlgorithmFactory.getAlgorithm(selectedAlgorithm)
                const canFit = await algorithmInstance.checkCapacity(
                    file.path,
                    message.length,
                    file.mimetype
                )

                if (!canFit) {
                    await this.fileProcessor.cleanupFile(file.path)
                    res.status(400).json({
                        success: false,
                        error: {
                            message: 'Message too large for selected file',
                            code: 'INSUFFICIENT_CAPACITY',
                        },
                    })
                    return
                }
            } catch (capacityError) {
                console.log('Capacity check error:', capacityError)
                // Продолжаем выполнение, capacity check не критичен
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

            // Определяем MIME тип результата
            const resultMimetype = this.getResultMimetype(
                selectedAlgorithm,
                file.mimetype
            )

            res.json({
                success: true,
                data: {
                    file: {
                        content: (result.data as Buffer).toString('base64'),
                        mimetype: resultMimetype,
                        filename: `steg_${file.originalname}`,
                    },
                    outputPath,
                    algorithm: selectedAlgorithm,
                    originalSize: file.size,
                    resultSize: (result.data as Buffer).length,
                    processingTime: result.metadata?.processingTime,
                    messageLength: message.length,
                },
                metadata: {
                    embedSuccess: true,
                    compressionRatio:
                        (result.data as Buffer).length / file.size,
                    capacityUsed: `${(
                        ((message.length * 8) / (file.size * 0.5)) *
                        100
                    ).toFixed(2)}%`,
                },
            })
        } catch (error) {
            console.log('Embed error:', error)

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
            const { algorithm = 'auto', password }: ExtractRequest = req.body
            const file = req.file

            console.log('=== EXTRACT REQUEST DEBUG ===')
            console.log('File:', file?.originalname)
            console.log('Mimetype:', file?.mimetype)
            console.log('Algorithm:', algorithm)
            console.log('Has password:', !!password)
            console.log('=============================')

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

            // Автовыбор алгоритма
            let selectedAlgorithm = algorithm
            if (algorithm === 'auto') {
                if (file.mimetype.startsWith('audio/')) {
                    selectedAlgorithm = 'lsb-audio'
                } else if (file.mimetype.startsWith('image/')) {
                    selectedAlgorithm = 'lsb'
                } else {
                    res.status(400).json({
                        success: false,
                        error: {
                            message: `Unsupported file type for extraction: ${file.mimetype}`,
                            code: 'UNSUPPORTED_FORMAT',
                        },
                    })
                    return
                }
            }

            console.log('Selected algorithm:', selectedAlgorithm)

            // Обработка файла (без строгой валидации)
            await this.fileProcessor.processUploadedFile(
                file.path,
                file.originalname,
                file.mimetype,
                { validateFormat: false }
            )

            // Извлечение сообщения
            const result = await this.steganographyService.extractMessage({
                filePath: file.path,
                mimetype: file.mimetype,
                algorithm: selectedAlgorithm,
                password,
            })

            // Очистка временного файла
            await this.fileProcessor.cleanupFile(file.path)

            logger.info('Extract operation completed successfully', {
                algorithm: selectedAlgorithm,
                messageLength: (result.data as string).length,
                processingTime: result.metadata?.processingTime,
            })

            res.json({
                success: true,
                data: {
                    message: result.data,
                    algorithm: selectedAlgorithm,
                    messageLength: (result.data as string).length,
                    processingTime: result.metadata?.processingTime,
                    fileSize: file.size,
                },
                metadata: {
                    extractSuccess: true,
                    isEncrypted: !!password,
                    sourceFile: file.originalname,
                },
            })
        } catch (error) {
            console.log('Extract error:', error)

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
                algorithms = AlgorithmFactory.getSupportedAlgorithms()
            }

            res.json({
                success: true,
                data: {
                    algorithms,
                    format: format || 'all',
                    byFormat: {
                        image: this.algorithmSelector.getAvailableAlgorithms(
                            'image/png'
                        ),
                        audio: this.algorithmSelector.getAvailableAlgorithms(
                            'audio/wav'
                        ),
                    },
                    supportedFormats: {
                        image: ['image/png', 'image/bmp', 'image/tiff'],
                        audio: ['audio/wav'],
                    },
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
            const { algorithm = 'auto', messageLength } = req.body

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

            // Автовыбор алгоритма
            let selectedAlgorithm = algorithm
            if (algorithm === 'auto') {
                if (file.mimetype.startsWith('audio/')) {
                    selectedAlgorithm = 'lsb-audio'
                } else if (file.mimetype.startsWith('image/')) {
                    selectedAlgorithm = 'lsb'
                } else {
                    res.status(400).json({
                        success: false,
                        error: {
                            message: `Unsupported file type: ${file.mimetype}`,
                            code: 'UNSUPPORTED_FORMAT',
                        },
                    })
                    return
                }
            }

            // Обработка файла
            await this.fileProcessor.processUploadedFile(
                file.path,
                file.originalname,
                file.mimetype,
                { validateFormat: false }
            )

            // Проверка вместимости
            const algorithmInstance =
                AlgorithmFactory.getAlgorithm(selectedAlgorithm)
            const canFit = await algorithmInstance.checkCapacity(
                file.path,
                parseInt(messageLength),
                file.mimetype
            )

            // Очистка временного файла
            await this.fileProcessor.cleanupFile(file.path)

            const capacityRatio = this.getCapacityRatio(file.mimetype)
            const estimatedCapacity = Math.floor(file.size * capacityRatio)

            res.json({
                success: true,
                data: {
                    canFit,
                    maxCapacity: estimatedCapacity,
                    requestedLength: parseInt(messageLength),
                    algorithm: selectedAlgorithm,
                    usagePercentage: `${(
                        ((parseInt(messageLength) * 8) /
                            (file.size * capacityRatio)) *
                        100
                    ).toFixed(2)}%`,
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
            case 'INCOMPATIBLE_ALGORITHM':
            case 'EMPTY_MESSAGE':
            case 'MESSAGE_TOO_LONG':
                return 400
            case 'CORRUPTED_DATA':
                return 422
            default:
                return 500
        }
    }

    private getResultMimetype(
        algorithm: string,
        originalMimetype: string
    ): string {
        if (algorithm === 'lsb') {
            return 'image/png'
        }
        if (algorithm === 'lsb-audio') {
            return 'audio/wav'
        }
        return originalMimetype
    }

    private getCapacityRatio(mimetype: string): number {
        if (mimetype.startsWith('image/')) {
            return 0.75 // 75% для изображений
        }
        if (mimetype.startsWith('audio/')) {
            return 0.5 // 50% для аудио
        }
        return 0.5
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
