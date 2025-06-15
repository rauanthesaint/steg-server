// src/algorithms/audio/lsb-audio.algorithm.ts
import { promises as fs } from 'fs'
import {
    InsufficientCapacityError,
    UnsupportedFormatError,
    CorruptedDataError,
} from '../../utils/error-handler'
import { encryptText, decryptText } from '../../utils/crypto-utils'
import { textToBinary, addMessageHeader } from '../../utils/binary-utils'
import { validateAudioFile, checkCapacity } from '../../utils/file-utils'
import { algorithmsConfig } from '../../config/algorithms.config'
import {
    SteganographyAlgorithm,
    EmbedOptions,
    ExtractOptions,
    AlgorithmMetadata,
} from '../base/algorithm.interface'

interface WavHeader {
    fileSize: number
    sampleRate: number
    bitsPerSample: number
    numChannels: number
    dataSize: number
    dataOffset: number
}

interface AudioData {
    header: WavHeader
    samples: Buffer
}

export class LSBAudioEncoder implements SteganographyAlgorithm {
    readonly name = 'LSB-Audio'
    readonly supportedFormats = algorithmsConfig.audio.lsb.supportedFormats
    readonly capacity = algorithmsConfig.audio.lsb.capacity as 'high'

    async embed(
        filePath: string,
        message: string,
        mimetype: string,
        options?: EmbedOptions
    ): Promise<Buffer> {
        // Валидация файла
        await validateAudioFile(filePath, mimetype)
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

        const audioData = await this.loadWavFile(filePath)

        // Проверка вместимости
        const availableSamples = this.getAvailableSamples(audioData)
        if (binaryWithHeader.length > availableSamples) {
            const maxCapacity = Math.floor(availableSamples / 8)
            const requiredCapacity = Math.ceil(binaryWithHeader.length / 8)
            throw new InsufficientCapacityError(requiredCapacity, maxCapacity)
        }

        // Встраивание битов в аудио сэмплы
        const modifiedSamples = Buffer.from(audioData.samples)
        this.embedBitsIntoSamples(
            modifiedSamples,
            binaryWithHeader,
            audioData.header
        )

        console.log(
            `LSB audio embedding completed: ${binaryWithHeader.length} bits embedded`
        )

        // Создание нового WAV файла
        return this.createWavFile(audioData.header, modifiedSamples)
    }

    async extract(
        filePath: string,
        mimetype: string,
        options?: ExtractOptions
    ): Promise<string> {
        console.log('=== LSB AUDIO EXTRACT DEBUG ===')
        console.log('Options received:', options)
        console.log('Password from options:', options?.password)
        console.log('===============================')

        // Валидация файла
        await validateAudioFile(filePath, mimetype)
        if (!this.supportedFormats.includes(mimetype)) {
            throw new UnsupportedFormatError(mimetype)
        }

        console.log('Starting LSB audio extraction...')
        const audioData = await this.loadWavFile(filePath)

        // Извлечение битов из сэмплов
        const extractedBits = this.extractBitsFromSamples(
            audioData.samples,
            audioData.header
        )
        console.log(`Extracted ${extractedBits.length} bits from audio`)

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
        const audioData = await this.loadWavFile(filePath)

        // Учитываем шифрование при расчете емкости
        let estimatedLength = messageLength
        if (options?.password) {
            estimatedLength = Math.ceil(messageLength * 1.5)
        }

        const binaryLength = estimatedLength * 8 + 32 // +32 для заголовка
        const availableSamples = this.getAvailableSamples(audioData)

        return binaryLength <= availableSamples
    }

    static getMetadata(): AlgorithmMetadata {
        return {
            name: 'LSB-Audio',
            description:
                'Least Significant Bit embedding in audio samples with optional AES encryption',
            supportedFormats: algorithmsConfig.audio.lsb.supportedFormats,
            capacity: 'high',
            security: 'medium',
        }
    }

    // === ПРИВАТНЫЕ МЕТОДЫ ===

    private async loadWavFile(filePath: string): Promise<AudioData> {
        try {
            const buffer = await fs.readFile(filePath)
            const header = this.parseWavHeader(buffer)
            const samples = buffer.slice(
                header.dataOffset,
                header.dataOffset + header.dataSize
            )

            return { header, samples }
        } catch (error) {
            throw new UnsupportedFormatError(
                `Failed to load audio file: ${error}`
            )
        }
    }

    private parseWavHeader(buffer: Buffer): WavHeader {
        // Проверка RIFF заголовка
        if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
            throw new UnsupportedFormatError(
                'Invalid WAV file: missing RIFF header'
            )
        }

        // Проверка WAVE формата
        if (buffer.toString('ascii', 8, 12) !== 'WAVE') {
            throw new UnsupportedFormatError(
                'Invalid WAV file: not WAVE format'
            )
        }

        // Поиск fmt chunk
        let offset = 12
        let fmtFound = false
        let dataOffset = 0
        let dataSize = 0

        while (offset < buffer.length - 8) {
            const chunkId = buffer.toString('ascii', offset, offset + 4)
            const chunkSize = buffer.readUInt32LE(offset + 4)

            if (chunkId === 'fmt ') {
                fmtFound = true
                // Пропускаем fmt chunk для простоты
            } else if (chunkId === 'data') {
                dataOffset = offset + 8
                dataSize = chunkSize
                break
            }

            offset += 8 + chunkSize
        }

        if (!fmtFound || dataOffset === 0) {
            throw new UnsupportedFormatError(
                'Invalid WAV file: missing required chunks'
            )
        }

        // Извлечение параметров из fmt chunk (упрощенно)
        const fileSize = buffer.readUInt32LE(4) + 8
        const sampleRate = 44100 // Используем стандартное значение
        const bitsPerSample = 16 // Предполагаем 16-бит
        const numChannels = 2 // Предполагаем стерео

        return {
            fileSize,
            sampleRate,
            bitsPerSample,
            numChannels,
            dataSize,
            dataOffset,
        }
    }

    private getAvailableSamples(audioData: AudioData): number {
        // Каждый сэмпл может хранить 1 бит (в младшем бите)
        // Для 16-битных сэмплов используем каждый второй байт
        return Math.floor(audioData.samples.length / 2)
    }

    private embedBitsIntoSamples(
        samples: Buffer,
        binaryData: string,
        header: WavHeader
    ): void {
        let bitIndex = 0

        // Встраиваем биты в младшие биты аудио сэмплов
        // Для 16-битного аудио работаем с каждым вторым байтом
        for (
            let i = 0;
            i < samples.length && bitIndex < binaryData.length;
            i += 2
        ) {
            const bit = parseInt(binaryData[bitIndex])

            // Заменяем младший бит в младшем байте сэмпла
            samples[i] = (samples[i] & 0xfe) | bit

            bitIndex++
        }
    }

    private extractBitsFromSamples(samples: Buffer, header: WavHeader): string {
        let bits = ''

        // Извлекаем биты из младших битов аудио сэмплов
        for (let i = 0; i < samples.length; i += 2) {
            const bit = samples[i] & 1
            bits += bit.toString()
        }

        return bits
    }

    private parseMessageHeader(binaryData: string): number {
        if (binaryData.length < 32) {
            throw new CorruptedDataError()
        }

        const lengthBits = binaryData.slice(0, 32)
        const length = parseInt(lengthBits, 2)

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
                if (charCode >= 0 && charCode <= 255) {
                    text += String.fromCharCode(charCode)
                }
            }
        }

        return text
    }

    private createWavFile(header: WavHeader, samples: Buffer): Buffer {
        // Создаем простой WAV заголовок
        const headerSize = 44
        const totalSize = headerSize + samples.length

        const wavHeader = Buffer.alloc(headerSize)

        // RIFF заголовок
        wavHeader.write('RIFF', 0)
        wavHeader.writeUInt32LE(totalSize - 8, 4)
        wavHeader.write('WAVE', 8)

        // fmt chunk
        wavHeader.write('fmt ', 12)
        wavHeader.writeUInt32LE(16, 16) // размер fmt chunk
        wavHeader.writeUInt16LE(1, 20) // PCM формат
        wavHeader.writeUInt16LE(header.numChannels, 22)
        wavHeader.writeUInt32LE(header.sampleRate, 24)
        wavHeader.writeUInt32LE(header.sampleRate * header.numChannels * 2, 28) // byte rate
        wavHeader.writeUInt16LE(header.numChannels * 2, 32) // block align
        wavHeader.writeUInt16LE(header.bitsPerSample, 34)

        // data chunk
        wavHeader.write('data', 36)
        wavHeader.writeUInt32LE(samples.length, 40)

        return Buffer.concat([wavHeader, samples])
    }
}
