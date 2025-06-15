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

        // Для аудио (если будет реализовано)
        if (mimetype.startsWith('audio/')) {
            return this.selectAudioAlgorithm(mimetype, messageLength)
        }

        // По умолчанию LSB
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

        // Здесь можно добавить другие алгоритмы
        // if (algorithmsConfig.image.dct?.supportedFormats.includes(mimetype)) {
        //     available.push('dct')
        // }

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
        // Заглушка для будущих аудио алгоритмов
        throw new UnsupportedFormatError(
            `Audio format not implemented: ${mimetype}`
        )
    }

    private isFormatSupported(mimetype: string): boolean {
        const allSupported = [
            ...fileTypesConfig.supported.image,
            // ...fileTypesConfig.supported.audio, // когда будет реализовано
        ]

        return allSupported.includes(mimetype)
    }
}
