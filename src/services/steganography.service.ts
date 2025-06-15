// src/services/steganography.service.ts
import { AlgorithmFactory } from '../algorithms/base/algorithm.factory'
import { logger } from '../utils/logger'
import fs from 'fs/promises'

interface ProcessRequest {
    filePath: string
    mimetype: string
    algorithm: string
    message?: string
    password?: string
}

interface ProcessResult {
    success: boolean
    data?: Buffer | string
    metadata?: {
        algorithm: string
        fileSize: number
        processingTime: number
    }
}

export class SteganographyService {
    async embedMessage(request: ProcessRequest): Promise<ProcessResult> {
        const startTime = Date.now()

        try {
            logger.info('Starting message embedding', {
                algorithm: request.algorithm,
                fileSize: await this.getFileSize(request.filePath),
                messageLength: request.message?.length,
            })

            const algorithm = AlgorithmFactory.getAlgorithm(request.algorithm)

            const result = await algorithm.embed(
                request.filePath,
                request.message!,
                request.mimetype,
                { password: request.password }
            )

            const processingTime = Date.now() - startTime

            logger.info('Message embedding completed', {
                algorithm: request.algorithm,
                processingTime,
            })

            return {
                success: true,
                data: result,
                metadata: {
                    algorithm: request.algorithm,
                    fileSize: result.length,
                    processingTime,
                },
            }
        } catch (error) {
            logger.error('Message embedding failed', {
                algorithm: request.algorithm,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
            throw error
        }
    }

    async extractMessage(request: ProcessRequest): Promise<ProcessResult> {
        const startTime = Date.now()

        try {
            logger.info('Starting message extraction', {
                algorithm: request.algorithm,
                fileSize: await this.getFileSize(request.filePath),
            })

            const algorithm = AlgorithmFactory.getAlgorithm(request.algorithm)

            const message = await algorithm.extract(
                request.filePath,
                request.mimetype,
                { password: request.password }
            )

            const processingTime = Date.now() - startTime

            logger.info('Message extraction completed', {
                algorithm: request.algorithm,
                messageLength: message.length,
                processingTime,
            })

            return {
                success: true,
                data: message,
                metadata: {
                    algorithm: request.algorithm,
                    fileSize: await this.getFileSize(request.filePath),
                    processingTime,
                },
            }
        } catch (error) {
            logger.error('Message extraction failed', {
                algorithm: request.algorithm,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
            throw error
        }
    }

    private async getFileSize(filePath: string): Promise<number> {
        try {
            const stats = await fs.stat(filePath)
            return stats.size
        } catch {
            return 0
        }
    }
}
