// src/utils/format-detector.ts - ЧИСТАЯ ВЕРСИЯ БЕЗ ОТЛАДКИ
import { createReadStream } from 'fs'

interface FileSignature {
    mimetype: string
    signature: number[]
    offset?: number
    secondaryCheck?: (buffer: Buffer) => boolean
}

const FILE_SIGNATURES: FileSignature[] = [
    {
        mimetype: 'image/png',
        signature: [0x89, 0x50, 0x4e, 0x47],
    },
    {
        mimetype: 'image/bmp',
        signature: [0x42, 0x4d],
    },
    {
        mimetype: 'image/tiff',
        signature: [0x49, 0x49, 0x2a, 0x00],
    },
    {
        mimetype: 'audio/wav',
        signature: [0x52, 0x49, 0x46, 0x46], // RIFF
        secondaryCheck: (buffer: Buffer) => {
            // Проверяем, что после RIFF идет WAVE (на позиции 8-11)
            if (buffer.length >= 12) {
                const waveSignature = buffer.slice(8, 12).toString('ascii')
                return waveSignature === 'WAVE'
            }
            return false
        },
    },
]

export async function detectFileFormat(
    filePath: string
): Promise<string | null> {
    const buffer = Buffer.alloc(16)
    const stream = createReadStream(filePath, { start: 0, end: 15 })

    return new Promise((resolve) => {
        stream.on('data', (chunk: Buffer) => {
            chunk.copy(buffer)

            for (const sig of FILE_SIGNATURES) {
                if (matchesSignature(buffer, sig.signature, sig.offset || 0)) {
                    // Если есть дополнительная проверка, выполняем её
                    if (sig.secondaryCheck && !sig.secondaryCheck(buffer)) {
                        continue
                    }
                    resolve(sig.mimetype)
                    return
                }
            }

            resolve(null)
        })

        stream.on('error', () => resolve(null))
        stream.on('end', () => resolve(null))
    })
}

function matchesSignature(
    buffer: Buffer,
    signature: number[],
    offset: number
): boolean {
    if (buffer.length < offset + signature.length) {
        return false
    }

    return signature.every((byte, i) => buffer[offset + i] === byte)
}
