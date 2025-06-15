// Типы файлов которые могут прийти с клиента
export type FileType =
    | 'image'
    | 'audio'
    | 'video'
    | 'text'
    | 'document'
    | 'other'

interface Result {
    success: boolean
    outputPath?: string
    algorithm?: string
    details?: string
    error?: string
}

export function getFileType(mimetype: string): FileType {
    const imageTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/bmp',
        'image/tiff',
        'image/gif',
    ]

    const audioTypes = [
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/flac',
        'audio/ogg',
    ]

    const videoTypes = [
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/wmv',
        'video/flv',
        'video/webm',
    ]

    const textTypes = [
        'text/plain',
        'text/html',
        'text/css',
        'text/javascript',
        'text/xml',
    ]

    const documentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    if (imageTypes.includes(mimetype)) return 'image'
    if (audioTypes.includes(mimetype)) return 'audio'
    if (videoTypes.includes(mimetype)) return 'video'
    if (textTypes.includes(mimetype)) return 'text'
    if (documentTypes.includes(mimetype)) return 'document'

    return 'other'
}

export function getAvailableAlgorithms(fileType: FileType): string[] {
    const algorithms: Record<FileType, string[]> = {
        image: ['LSB', 'DCT', 'DWT'],
        audio: ['LSB_Audio', 'Echo_Hiding', 'Phase_Coding', 'Spread_Spectrum'],
        video: ['Frame_LSB', 'Motion_Vector', 'DCT_Video'],
        text: ['White_Space', 'Synonym_Substitution', 'Character_Encoding'],
        document: [
            'Formatting_Based',
            'Metadata_Embedding',
            'Structure_Modification',
        ],
        other: ['File_System', 'Executable_Steganography'],
    }

    return algorithms[fileType] || []
}

async function applySteganography(
    fileType: FileType,
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    try {
        switch (fileType) {
            case 'image':
                return await applyImageSteganography(
                    algorithm,
                    inputPath,
                    outputPath,
                    message
                )

            case 'audio':
                return await applyAudioSteganography(
                    algorithm,
                    inputPath,
                    outputPath,
                    message
                )

            case 'video':
                return await applyVideoSteganography(
                    algorithm,
                    inputPath,
                    outputPath,
                    message
                )

            case 'text':
                return await applyTextSteganography(
                    algorithm,
                    inputPath,
                    outputPath,
                    message
                )

            case 'document':
                return await applyDocumentSteganography(
                    algorithm,
                    inputPath,
                    outputPath,
                    message
                )

            case 'other':
                return await applyOtherSteganography(
                    algorithm,
                    inputPath,
                    outputPath,
                    message
                )

            default:
                return {
                    success: false,
                    error: `Unsupported file type: ${fileType}`,
                }
        }
    } catch (error) {
        return {
            success: false,
            error: `Error applying steganography: ${
                error instanceof Error ? error.message : String(error)
            }`,
        }
    }
}

// =============================================================================
// АЛГОРИТМЫ ДЛЯ ИЗОБРАЖЕНИЙ
// =============================================================================

async function applyImageSteganography(
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    switch (algorithm) {
        case 'LSB':
            return await applyLSBImage(inputPath, outputPath, message)

        case 'DCT':
            return await applyDCTImage(inputPath, outputPath, message)

        case 'DWT':
            return await applyDWTImage(inputPath, outputPath, message)

        default:
            return {
                success: false,
                error: `Unknown image algorithm: ${algorithm}`,
            }
    }
}

// LSB для изображений (используем ваш существующий код)
async function applyLSBImage(
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    try {
        // Импортируем вашу функцию
        const { embedMessage } = await import('src/utils/leastSignificantBit')

        const result = await embedMessage(inputPath, outputPath, message)

        return {
            success: true,
            outputPath,
            algorithm: 'LSB',
            details: result,
        }
    } catch (error) {
        return {
            success: false,
            error: `LSB embedding failed: ${
                error instanceof Error ? error.message : String(error)
            }`,
        }
    }
}

// DCT для изображений (заглушка)
async function applyDCTImage(
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    // TODO: Реализовать DCT алгоритм
    return {
        success: false,
        error: 'DCT algorithm not implemented yet',
    }
}

// DWT для изображений (заглушка)
async function applyDWTImage(
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    // TODO: Реализовать DWT алгоритм
    return {
        success: false,
        error: 'DWT algorithm not implemented yet',
    }
}

// =============================================================================
// АЛГОРИТМЫ ДЛЯ АУДИО (заглушки)
// =============================================================================

async function applyAudioSteganography(
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    return {
        success: false,
        error: 'Audio steganography not implemented yet',
    }
}

// =============================================================================
// АЛГОРИТМЫ ДЛЯ ВИДЕО (заглушки)
// =============================================================================

async function applyVideoSteganography(
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    return {
        success: false,
        error: 'Video steganography not implemented yet',
    }
}

// =============================================================================
// АЛГОРИТМЫ ДЛЯ ТЕКСТА (заглушки)
// =============================================================================

async function applyTextSteganography(
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    return {
        success: false,
        error: 'Text steganography not implemented yet',
    }
}

// =============================================================================
// АЛГОРИТМЫ ДЛЯ ДОКУМЕНТОВ (заглушки)
// =============================================================================

async function applyDocumentSteganography(
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    return {
        success: false,
        error: 'Document steganography not implemented yet',
    }
}

// =============================================================================
// ДРУГИЕ АЛГОРИТМЫ (заглушки)
// =============================================================================

async function applyOtherSteganography(
    algorithm: string,
    inputPath: string,
    outputPath: string,
    message: string
): Promise<Result> {
    return {
        success: false,
        error: 'Other steganography not implemented yet',
    }
}
