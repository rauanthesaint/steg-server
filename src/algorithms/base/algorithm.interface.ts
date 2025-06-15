// src/base/algorithm.interface.ts
export interface SteganographyAlgorithm {
    readonly name: string
    readonly supportedFormats: string[]
    readonly capacity: 'low' | 'medium' | 'high'

    embed(
        filePath: string,
        message: string,
        mimetype: string,
        options?: EmbedOptions
    ): Promise<Buffer>

    extract(
        filePath: string,
        mimetype: string,
        options?: ExtractOptions
    ): Promise<string>

    checkCapacity(
        filePath: string,
        messageLength: number,
        mimetype: string
    ): Promise<boolean>
}

export interface EmbedOptions {
    password?: string
    quality?: number
    compressionLevel?: number
}

export interface ExtractOptions {
    password?: string
}

export interface AlgorithmMetadata {
    name: string
    description: string
    supportedFormats: string[]
    capacity: 'low' | 'medium' | 'high'
    security: 'low' | 'medium' | 'high'
}
