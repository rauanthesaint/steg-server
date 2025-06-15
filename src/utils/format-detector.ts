// src/utils/format-detector.ts
import { createReadStream } from 'fs'
import { fileTypesConfig } from '../config/file-types.config'

interface FileSignature {
    mimetype: string
    signature: number[]
    offset?: number
}

const FILE_SIGNATURES: FileSignature[] = Object.entries(
    fileTypesConfig.signatures
).map(([mimetype, signature]) => ({ mimetype, signature }))

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
                    resolve(sig.mimetype)
                    return
                }
            }

            resolve(null)
        })

        stream.on('error', () => resolve(null))
    })
}

function matchesSignature(
    buffer: Buffer,
    signature: number[],
    offset: number
): boolean {
    return signature.every((byte, i) => buffer[offset + i] === byte)
}
