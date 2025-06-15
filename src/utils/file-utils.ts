import { UnsupportedFormatError } from './error-handler'
import { detectFileFormat } from './format-detector'
import { fileTypesConfig } from '../config/file-types.config'

export function isSupportedFormat(mimetype: string): boolean {
    return fileTypesConfig.supported.image.includes(mimetype)
}

export function validateFileSignature(
    buffer: Buffer,
    mimetype: string
): boolean {
    const signature =
        fileTypesConfig.signatures[
            mimetype as keyof typeof fileTypesConfig.signatures
        ]
    if (!signature) return false

    return signature.every((byte, i) => buffer[i] === byte)
}

export async function validateImageFile(
    filePath: string,
    mimetype: string
): Promise<boolean> {
    // Проверка MIME типа
    if (!isSupportedFormat(mimetype)) {
        throw new UnsupportedFormatError(mimetype)
    }

    // Автоопределение реального формата файла
    const detectedFormat = await detectFileFormat(filePath)

    if (!detectedFormat) {
        throw new Error('Cannot detect file format')
    }

    // Сравнение заявленного и реального формата
    if (detectedFormat !== mimetype) {
        throw new Error(
            `Format mismatch: expected ${mimetype}, detected ${detectedFormat}`
        )
    }

    return true
}

export function checkCapacity(
    fileSize: number,
    channels: number,
    messageLength: number
): boolean {
    const headerBits = 32
    const endMarkerBits = 16
    const totalBitsNeeded = headerBits + messageLength + endMarkerBits
    const maxCapacity = fileSize * channels

    return totalBitsNeeded <= maxCapacity
}

export function calculateMaxCapacity(
    fileSize: number,
    channels: number
): number {
    const headerBits = 32
    const endMarkerBits = 16
    const maxMessageBits = fileSize * channels - headerBits - endMarkerBits

    return Math.max(0, Math.floor(maxMessageBits / 8))
}
