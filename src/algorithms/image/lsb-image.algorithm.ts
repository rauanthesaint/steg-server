// src/algorithms/image/lsb-encoder.ts
import sharp from 'sharp'
import {
    InsufficientCapacityError,
    UnsupportedFormatError,
    CorruptedDataError,
} from '../../utils/error-handler'
import { encryptText, decryptText } from '../../utils/crypto-utils'
import { textToBinary, addMessageHeader } from '../../utils/binary-utils'
import { validateImageFile, checkCapacity } from '../../utils/file-utils'
import { algorithmsConfig } from '../../config/algorithms.config'
import {
    SteganographyAlgorithm,
    EmbedOptions,
    ExtractOptions,
    AlgorithmMetadata,
} from '../base/algorithm.interface'

interface ImageData {
    data: Buffer
    width: number
    height: number
    channels: number
}

export class LSBEncoder implements SteganographyAlgorithm {
    readonly name = 'LSB'
    readonly supportedFormats = algorithmsConfig.image.lsb.supportedFormats
    readonly capacity = algorithmsConfig.image.lsb.capacity as 'high'

    async embed(
        filePath: string,
        message: string,
        mimetype: string,
        options?: EmbedOptions
    ): Promise<Buffer> {
        // Валидация файла
        await validateImageFile(filePath, mimetype)
        if (!this.supportedFormats.includes(mimetype)) {
            throw new UnsupportedFormatError(mimetype)
        }
        // Шифрование сообщения если есть пароль
        let processedMessage = message
        if (options?.password) {
            console.log('Encrypting message with password...')
            processedMessage = encryptText(message, options.password)
            console.log(
                `Message encrypted: ${message.length} → ${processedMessage.length} chars`
            )
        }

        // Конвертация в бинарные данные
        const binaryMessage = textToBinary(processedMessage)
        const binaryWithHeader = addMessageHeader(binaryMessage)

        const image = await this.loadImage(filePath)

        // Проверка вместимости (с учетом зашифрованного сообщения)
        if (
            !checkCapacity(
                image.data.length,
                image.channels,
                binaryWithHeader.length
            )
        ) {
            const maxCapacity =
                Math.floor((image.data.length * image.channels) / 8) - 4 // -4 байта для заголовка
            const requiredCapacity = Math.ceil(binaryWithHeader.length / 8)

            throw new InsufficientCapacityError(requiredCapacity, maxCapacity)
        }

        // Встраивание
        const modifiedData = Buffer.from(image.data)
        this.embedBitsIntoPixels(modifiedData, binaryWithHeader, image.channels)

        // Валидация каналов для Sharp
        const validChannels = [1, 2, 3, 4].includes(image.channels)
            ? (image.channels as 1 | 2 | 3 | 4)
            : 3

        console.log(
            `LSB embedding completed: ${binaryWithHeader.length} bits embedded`
        )

        return sharp(modifiedData, {
            raw: {
                width: image.width,
                height: image.height,
                channels: validChannels,
            },
        })
            .png()
            .toBuffer()
    }

    async extract(
        filePath: string,
        mimetype: string,
        options?: ExtractOptions
    ): Promise<string> {
        // 🔍 ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ
        console.log('=== LSB EXTRACT DEBUG ===')
        console.log('Options received:', options)
        console.log('Password from options:', options?.password)
        console.log('Password type:', typeof options?.password)
        console.log('Has password:', !!options?.password)
        console.log('========================')

        // Валидация файла
        await validateImageFile(filePath, mimetype)
        if (!this.supportedFormats.includes(mimetype)) {
            throw new UnsupportedFormatError(mimetype)
        }

        console.log('Starting LSB extraction...')
        const image = await this.loadImage(filePath)

        // Извлечение битов из пикселей
        const extractedBits = this.extractBitsFromPixels(
            image.data,
            image.channels
        )
        console.log(`Extracted ${extractedBits.length} bits from image`)

        // Парсинг заголовка для получения длины сообщения
        const messageLength = this.parseMessageHeader(extractedBits)
        if (messageLength <= 0 || messageLength > extractedBits.length - 32) {
            throw new CorruptedDataError()
        }

        console.log(`Message length from header: ${messageLength} bits`)

        // Извлечение сообщения без заголовка
        const messageBits = extractedBits.slice(32, 32 + messageLength)
        let extractedMessage = this.binaryToText(messageBits)

        console.log(
            `Extracted raw message length: ${extractedMessage.length} chars`
        )

        // Расшифровка если есть пароль
        if (options?.password) {
            console.log('Attempting to decrypt message...')
            try {
                const decryptedMessage = decryptText(
                    extractedMessage,
                    options.password
                )
                console.log(
                    `Message decrypted successfully: ${decryptedMessage.length} chars`
                )
                return decryptedMessage
            } catch (error) {
                console.error('Decryption failed:', error)
                throw new CorruptedDataError()
            }
        }

        return extractedMessage
    }

    async checkCapacity(
        filePath: string,
        messageLength: number,
        mimetype: string,
        options?: { password?: string }
    ): Promise<boolean> {
        const image = await this.loadImage(filePath)

        // Учитываем шифрование при расчете емкости
        let estimatedLength = messageLength
        if (options?.password) {
            // Приблизительная оценка увеличения размера после шифрования
            // AES обычно увеличивает размер на ~30-50%
            estimatedLength = Math.ceil(messageLength * 1.5)
        }

        const binaryLength = estimatedLength * 8 + 32 // +32 для заголовка
        return checkCapacity(image.data.length, image.channels, binaryLength)
    }

    static getMetadata(): AlgorithmMetadata {
        return {
            name: 'LSB',
            description:
                'Least Significant Bit embedding in image pixels with optional AES encryption',
            supportedFormats: algorithmsConfig.image.lsb.supportedFormats,
            capacity: 'high',
            security: 'medium', // повысили с 'low' из-за шифрования
        }
    }

    // === ПРИВАТНЫЕ МЕТОДЫ ===

    private extractBitsFromPixels(data: Buffer, channels: number): string {
        let bits = ''

        for (let i = 0; i < data.length; i++) {
            // Пропускаем альфа-канал
            if (channels === 4 && (i + 1) % 4 === 0) {
                continue
            }

            // Извлекаем младший бит
            const bit = data[i] & 1
            bits += bit.toString()
        }

        return bits
    }

    private parseMessageHeader(binaryData: string): number {
        if (binaryData.length < 32) {
            throw new CorruptedDataError()
        }

        // Первые 32 бита содержат длину сообщения
        const lengthBits = binaryData.slice(0, 32)
        const length = parseInt(lengthBits, 2)

        // Дополнительная валидация
        if (length === 0 || length > binaryData.length - 32) {
            throw new CorruptedDataError()
        }

        return length
    }

    private binaryToText(binaryData: string): string {
        let text = ''

        for (let i = 0; i < binaryData.length; i += 8) {
            const byte = binaryData.slice(i, i + 8)
            if (byte.length === 8) {
                const charCode = parseInt(byte, 2)
                // Дополнительная проверка на валидность символа
                if (charCode >= 0 && charCode <= 255) {
                    text += String.fromCharCode(charCode)
                }
            }
        }

        return text
    }

    private async loadImage(imagePath: string): Promise<ImageData> {
        try {
            const image = sharp(imagePath)
            const { data, info } = await image
                .raw()
                .toBuffer({ resolveWithObject: true })

            return {
                data,
                width: info.width,
                height: info.height,
                channels: info.channels,
            }
        } catch (error) {
            throw new UnsupportedFormatError(`Failed to load image: ${error}`)
        }
    }

    private embedBitsIntoPixels(
        data: Buffer,
        binaryData: string,
        channels: number
    ): void {
        let bitIndex = 0

        // Проходим по всем байтам изображения
        for (let i = 0; i < data.length && bitIndex < binaryData.length; i++) {
            // Пропускаем альфа-канал (каждый 4-й байт при RGBA)
            if (channels === 4 && (i + 1) % 4 === 0) {
                continue
            }

            // Заменяем младший бит
            const bit = parseInt(binaryData[bitIndex])
            data[i] = (data[i] & 0xfe) | bit

            bitIndex++
        }
    }

    // === DEPRECATED МЕТОД (для обратной совместимости) ===

    /**
     * @deprecated Используйте embed() вместо embedMessage()
     */
    async embedMessage(
        imagePath: string,
        text: string,
        mimetype: string,
        password?: string
    ): Promise<Buffer> {
        console.warn('embedMessage() is deprecated. Use embed() instead.')
        return this.embed(imagePath, text, mimetype, { password })
    }
}
