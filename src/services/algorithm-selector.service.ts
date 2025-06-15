// src/services/algorithm-selector.service.ts
import { AlgorithmFactory } from '../algorithms/base/algorithm.factory'
import { algorithmsConfig } from '../config/algorithms.config'
import { fileTypesConfig } from '../config/file-types.config'
import { UnsupportedFormatError } from '../utils/error-handler'

interface AlgorithmRecommendation {
    algorithm: string
    reason: string
    capacity: 'low' | 'medium' | 'high'
    security: 'low' | 'medium' | 'high'
}

export class AlgorithmSelectorService {
    /**
     * Выбирает наилучший алгоритм для данного типа файла
     */
    selectBestAlgorithm(
        mimetype: string,
        messageLength?: number
    ): AlgorithmRecommendation {
        // Проверяем поддержку формата
        if (!this.isFormatSupported(mimetype)) {
            throw new UnsupportedFormatError(mimetype)
        }

        // Для изображений
        if (mimetype.startsWith('image/')) {
            return this.selectImageAlgorithm(mimetype, messageLength)
        }

        // Для аудио
        if (mimetype.startsWith('audio/')) {
            return this.selectAudioAlgorithm(mimetype, messageLength)
        }

        // По умолчанию LSB для изображений
        return {
            algorithm: 'lsb',
            reason: 'Default algorithm for supported format',
            capacity: 'high',
            security: 'low',
        }
    }

    /**
     * Получает все доступные алгоритмы для формата
     */
    getAvailableAlgorithms(mimetype: string): string[] {
        const available: string[] = []

        // Проверяем LSB для изображений
        if (algorithmsConfig.image.lsb.supportedFormats.includes(mimetype)) {
            available.push('lsb')
        }

        // Проверяем LSB для аудио
        if (algorithmsConfig.audio.lsb.supportedFormats.includes(mimetype)) {
            available.push('lsb-audio')
        }

        return available
    }

    /**
     * Проверяет совместимость алгоритма с форматом
     */
    isCompatible(algorithm: string, mimetype: string): boolean {
        try {
            const supportedAlgorithms =
                AlgorithmFactory.getSupportedAlgorithms()
            if (!supportedAlgorithms.includes(algorithm)) {
                return false
            }

            const algorithmInstance = AlgorithmFactory.getAlgorithm(algorithm)
            return algorithmInstance.supportedFormats.includes(mimetype)
        } catch {
            return false
        }
    }

    private selectImageAlgorithm(
        mimetype: string,
        messageLength?: number
    ): AlgorithmRecommendation {
        // Для PNG/BMP/TIFF - LSB
        if (algorithmsConfig.image.lsb.supportedFormats.includes(mimetype)) {
            const reason =
                messageLength && messageLength > 1000
                    ? 'LSB recommended for large messages'
                    : 'LSB optimal for lossless formats'

            return {
                algorithm: 'lsb',
                reason,
                capacity: 'high',
                security: 'low',
            }
        }

        throw new UnsupportedFormatError(mimetype)
    }

    private selectAudioAlgorithm(
        mimetype: string,
        messageLength?: number
    ): AlgorithmRecommendation {
        // Для WAV файлов - LSB-Audio
        if (algorithmsConfig.audio.lsb.supportedFormats.includes(mimetype)) {
            const reason =
                messageLength && messageLength > 5000
                    ? 'LSB-Audio recommended for large messages in audio'
                    : 'LSB-Audio optimal for WAV format'

            return {
                algorithm: 'lsb-audio',
                reason,
                capacity: 'high',
                security: 'medium',
            }
        }

        throw new UnsupportedFormatError(
            `Audio format not supported: ${mimetype}`
        )
    }

    private isFormatSupported(mimetype: string): boolean {
        const allSupported = [
            ...fileTypesConfig.supported.image,
            ...fileTypesConfig.supported.audio,
        ]

        return allSupported.includes(mimetype)
    }
}
