// src/utils/error-handler.ts

export class SteganographyError extends Error {
    constructor(message: string, public code: string) {
        super(message)
        this.name = 'SteganographyError'
    }
}

export class InsufficientCapacityError extends SteganographyError {
    constructor(required: number, available: number) {
        super(
            `Message too large. Required: ${required} bits, Available: ${available} bits`,
            'INSUFFICIENT_CAPACITY'
        )
    }
}

export class CorruptedDataError extends SteganographyError {
    constructor() {
        super('Corrupted steganographic data detected', 'CORRUPTED_DATA')
    }
}

export class UnsupportedFormatError extends SteganographyError {
    constructor(format: string) {
        super(`Unsupported file format: ${format}`, 'UNSUPPORTED_FORMAT')
    }
}

export function handleSteganographyError(error: unknown): {
    message: string
    code: string
} {
    if (error instanceof SteganographyError) {
        return {
            message: error.message,
            code: error.code,
        }
    }

    return {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
    }
}
