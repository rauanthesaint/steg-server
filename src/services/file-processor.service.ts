// src/services/file-processor.service.ts
import { promises as fs } from 'fs'
import { join } from 'path'
import { appConfig } from '../config/app.config'
import { fileTypesConfig } from '../config/file-types.config'
import { detectFileFormat } from '../utils/format-detector'
import { validateImageFile, validateAudioFile } from '../utils/file-utils'
import { logger } from '../utils/logger'
import { UnsupportedFormatError } from '../utils/error-handler'

interface ProcessedFile {
    path: string
    originalName: string
    mimetype: string
    size: number
    detectedFormat: string | null
}

interface FileProcessingOptions {
    validateFormat?: boolean
    maxSize?: number
    allowedFormats?: string[]
}

export class FileProcessorService {
    /**
     * Обрабатывает загруженный файл
     */
    async processUploadedFile(
        filePath: string,
        originalName: string,
        mimetype: string,
        options: FileProcessingOptions = {}
    ): Promise<ProcessedFile> {
        const {
            validateFormat = true,
            maxSize = appConfig.maxFileSize,
            allowedFormats = [
                ...fileTypesConfig.supported.image,
                ...fileTypesConfig.supported.audio,
            ],
        } = options

        logger.info('Processing uploaded file', {
            originalName,
            mimetype,
            filePath,
            validateFormat,
        })

        // Проверка существования файла
        await this.ensureFileExists(filePath)

        // Получение информации о файле
        const stats = await fs.stat(filePath)

        // Проверка размера
        if (stats.size > maxSize) {
            await this.cleanupFile(filePath)
            throw new Error(
                `File too large: ${stats.size} bytes, max: ${maxSize} bytes`
            )
        }

        // Проверка MIME типа
        if (!allowedFormats.includes(mimetype)) {
            await this.cleanupFile(filePath)
            throw new UnsupportedFormatError(mimetype)
        }

        // Определение реального формата
        let detectedFormat: string | null = null
        if (validateFormat) {
            detectedFormat = await detectFileFormat(filePath)

            if (!detectedFormat) {
                await this.cleanupFile(filePath)
                throw new Error('Cannot detect file format')
            }

            if (detectedFormat !== mimetype) {
                await this.cleanupFile(filePath)
                throw new Error(
                    `Format mismatch: expected ${mimetype}, detected ${detectedFormat}`
                )
            }

            // Дополнительная валидация в зависимости от типа файла
            try {
                if (mimetype.startsWith('image/')) {
                    await validateImageFile(filePath, mimetype)
                } else if (mimetype.startsWith('audio/')) {
                    await validateAudioFile(filePath, mimetype)
                }
            } catch (error) {
                await this.cleanupFile(filePath)
                throw error
            }
        }

        logger.info('File processing completed', {
            originalName,
            size: stats.size,
            detectedFormat,
            mimetype,
        })

        return {
            path: filePath,
            originalName,
            mimetype,
            size: stats.size,
            detectedFormat,
        }
    }

    /**
     * Сохраняет результат обработки
     */
    async saveProcessedFile(
        data: Buffer,
        originalName: string
    ): Promise<string> {
        const timestamp = Date.now()
        const outputFileName = `processed_${timestamp}_${originalName}`
        const outputPath = join(appConfig.outputsDir, outputFileName)

        // Создаем директорию если не существует
        await fs.mkdir(appConfig.outputsDir, { recursive: true })

        await fs.writeFile(outputPath, data)

        logger.info('Processed file saved', {
            outputPath,
            size: data.length,
        })

        return outputPath
    }

    /**
     * Очищает временный файл
     */
    async cleanupFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath)
            logger.debug('Temporary file cleaned up', { filePath })
        } catch (error) {
            logger.warn('Failed to cleanup temporary file', {
                filePath,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }
    }

    /**
     * Очищает старые временные файлы
     */
    async cleanupOldFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
        const directories = [appConfig.uploadsDir, appConfig.outputsDir]
        const now = Date.now()

        for (const dir of directories) {
            try {
                const files = await fs.readdir(dir)

                for (const file of files) {
                    const filePath = join(dir, file)
                    const stats = await fs.stat(filePath)

                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.unlink(filePath)
                        logger.debug('Old file cleaned up', { filePath })
                    }
                }
            } catch (error) {
                logger.warn('Failed to cleanup directory', {
                    directory: dir,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                })
            }
        }
    }

    /**
     * Получает информацию о файле
     */
    async getFileInfo(filePath: string): Promise<{
        size: number
        mimetype: string | null
        exists: boolean
    }> {
        try {
            const stats = await fs.stat(filePath)
            const detectedFormat = await detectFileFormat(filePath)

            return {
                size: stats.size,
                mimetype: detectedFormat,
                exists: true,
            }
        } catch {
            return {
                size: 0,
                mimetype: null,
                exists: false,
            }
        }
    }

    private async ensureFileExists(filePath: string): Promise<void> {
        try {
            await fs.access(filePath)
        } catch {
            throw new Error(`File not found: ${filePath}`)
        }
    }
}
