// src/services/validation.service.ts
import { AlgorithmSelectorService } from './algorithm-selector.service'
import { FileProcessorService } from './file-processor.service'
import { AlgorithmFactory } from '../algorithms/base/algorithm.factory'
import { appConfig } from '../config/app.config'
import { fileTypesConfig } from '../config/file-types.config'
import { logger } from '../utils/logger'
import {
    UnsupportedFormatError,
    InsufficientCapacityError,
    CorruptedDataError,
} from '../utils/error-handler'

interface ValidationRequest {
    filePath: string
    mimetype: string
    algorithm: string
    message?: string
    password?: string
}

interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
    metadata: {
        fileSize: number
        estimatedCapacity?: number
        compressionRatio?: number
    }
}

export class ValidationService {
    private algorithmSelector = new AlgorithmSelectorService()
    private fileProcessor = new FileProcessorService()

    /**
     * Комплексная валидация для операции встраивания
     */
    async validateEmbedRequest(
        request: ValidationRequest
    ): Promise<ValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []
        let fileSize = 0
        let estimatedCapacity = 0

        logger.info('Starting embed validation', {
            algorithm: request.algorithm,
            mimetype: request.mimetype,
            messageLength: request.message?.length,
        })

        try {
            // 1. Валидация файла
            const fileInfo = await this.fileProcessor.getFileInfo(
                request.filePath
            )
            if (!fileInfo.exists) {
                errors.push('File does not exist')
                return this.createValidationResult(false, errors, warnings, {
                    fileSize: 0,
                })
            }

            fileSize = fileInfo.size

            // 2. Проверка размера файла
            if (fileSize > appConfig.maxFileSize) {
                errors.push(
                    `File too large: ${fileSize} bytes, max: ${appConfig.maxFileSize} bytes`
                )
            }

            if (fileSize < 1024) {
                // Минимум 1KB
                warnings.push(
                    'Very small file, limited capacity for message embedding'
                )
            }

            // 3. Валидация формата
            if (!fileTypesConfig.supported.image.includes(request.mimetype)) {
                errors.push(`Unsupported file format: ${request.mimetype}`)
            }

            // 4. Валидация алгоритма
            if (
                !this.algorithmSelector.isCompatible(
                    request.algorithm,
                    request.mimetype
                )
            ) {
                errors.push(
                    `Algorithm ${request.algorithm} is not compatible with ${request.mimetype}`
                )
            }

            // 5. Валидация сообщения
            if (!request.message) {
                errors.push('Message is required for embedding')
            } else {
                if (request.message.length > appConfig.maxMessageLength) {
                    errors.push(
                        `Message too long: ${request.message.length} chars, max: ${appConfig.maxMessageLength}`
                    )
                }

                if (request.message.length === 0) {
                    errors.push('Message cannot be empty')
                }

                // Проверка вместимости
                if (errors.length === 0) {
                    const algorithm = AlgorithmFactory.getAlgorithm(
                        request.algorithm
                    )
                    const canFit = await algorithm.checkCapacity(
                        request.filePath,
                        request.message.length,
                        request.mimetype
                    )

                    if (!canFit) {
                        errors.push('Message too large for selected file')
                    } else {
                        // Приблизительная оценка вместимости
                        estimatedCapacity = this.estimateCapacity(
                            fileSize,
                            request.mimetype
                        )

                        const usageRatio =
                            (request.message.length * 8) / estimatedCapacity
                        if (usageRatio > 0.8) {
                            warnings.push(
                                'High capacity usage, may affect image quality'
                            )
                        }
                    }
                }
            }

            // 6. Валидация пароля
            if (request.password) {
                if (request.password.length < 6) {
                    warnings.push(
                        'Password is short, consider using a stronger password'
                    )
                }
                if (
                    !/[A-Z]/.test(request.password) ||
                    !/[0-9]/.test(request.password)
                ) {
                    warnings.push(
                        'Password should contain uppercase letters and numbers'
                    )
                }
            }
        } catch (error) {
            errors.push(
                `Validation failed: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }

        const isValid = errors.length === 0

        logger.info('Embed validation completed', {
            isValid,
            errorsCount: errors.length,
            warningsCount: warnings.length,
        })

        return this.createValidationResult(isValid, errors, warnings, {
            fileSize,
            estimatedCapacity:
                estimatedCapacity > 0 ? estimatedCapacity : undefined,
        })
    }

    /**
     * Комплексная валидация для операции извлечения
     */
    async validateExtractRequest(
        request: ValidationRequest
    ): Promise<ValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []
        let fileSize = 0

        logger.info('Starting extract validation', {
            algorithm: request.algorithm,
            mimetype: request.mimetype,
        })

        try {
            // 1. Валидация файла
            const fileInfo = await this.fileProcessor.getFileInfo(
                request.filePath
            )
            if (!fileInfo.exists) {
                errors.push('File does not exist')
                return this.createValidationResult(false, errors, warnings, {
                    fileSize: 0,
                })
            }

            fileSize = fileInfo.size

            // 2. Валидация формата
            if (!fileTypesConfig.supported.image.includes(request.mimetype)) {
                errors.push(`Unsupported file format: ${request.mimetype}`)
            }

            // 3. Валидация алгоритма
            if (
                !this.algorithmSelector.isCompatible(
                    request.algorithm,
                    request.mimetype
                )
            ) {
                errors.push(
                    `Algorithm ${request.algorithm} is not compatible with ${request.mimetype}`
                )
            }

            // 4. Проверка на наличие встроенных данных (базовая)
            if (fileSize < 2048) {
                // Минимальный размер для содержательного файла со стего-данными
                warnings.push(
                    'File seems too small to contain meaningful steganographic data'
                )
            }
        } catch (error) {
            errors.push(
                `Validation failed: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }

        const isValid = errors.length === 0

        logger.info('Extract validation completed', {
            isValid,
            errorsCount: errors.length,
            warningsCount: warnings.length,
        })

        return this.createValidationResult(isValid, errors, warnings, {
            fileSize,
        })
    }

    /**
     * Валидация совместимости алгоритма и формата
     */
    validateAlgorithmCompatibility(
        algorithm: string,
        mimetype: string
    ): boolean {
        return this.algorithmSelector.isCompatible(algorithm, mimetype)
    }

    /**
     * Получение рекомендаций по оптимизации
     */
    getOptimizationRecommendations(
        fileSize: number,
        messageLength: number,
        mimetype: string
    ): string[] {
        const recommendations: string[] = []
        const estimatedCapacity = this.estimateCapacity(fileSize, mimetype)
        const usageRatio = (messageLength * 8) / estimatedCapacity

        if (usageRatio > 0.9) {
            recommendations.push(
                'Consider using a larger image or shorter message'
            )
        }

        if (mimetype === 'image/jpeg') {
            recommendations.push(
                'Consider converting to PNG for better steganography results'
            )
        }

        if (fileSize > 10 * 1024 * 1024) {
            // 10MB
            recommendations.push('Large files may take longer to process')
        }

        return recommendations
    }

    private estimateCapacity(fileSize: number, mimetype: string): number {
        // Приблизительная оценка на основе формата
        switch (mimetype) {
            case 'image/png':
            case 'image/bmp':
                return Math.floor(fileSize * 0.75) // ~75% пикселей доступны
            case 'image/tiff':
                return Math.floor(fileSize * 0.6) // Меньше из-за сжатия
            default:
                return Math.floor(fileSize * 0.5)
        }
    }

    private createValidationResult(
        isValid: boolean,
        errors: string[],
        warnings: string[],
        metadata: ValidationResult['metadata']
    ): ValidationResult {
        return {
            isValid,
            errors,
            warnings,
            metadata,
        }
    }
}
