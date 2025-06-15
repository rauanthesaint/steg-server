// src/algorithms/base/algorithm.factory.ts
import { SteganographyAlgorithm } from './algorithm.interface'
import { LSBEncoder } from '../image/lsb-image.algorithm'
import { LSBAudioEncoder } from '../audio/lsb-audio.algorithm'

export class AlgorithmFactory {
    private static algorithms = new Map<string, () => SteganographyAlgorithm>([
        ['lsb', () => new LSBEncoder()],
        ['lsb-audio', () => new LSBAudioEncoder()],
    ])

    static getAlgorithm(name: string): SteganographyAlgorithm {
        const algorithmFactory = this.algorithms.get(name.toLowerCase())
        if (!algorithmFactory) {
            throw new Error(`Unknown algorithm: ${name}`)
        }
        return algorithmFactory()
    }

    static getSupportedAlgorithms(): string[] {
        return Array.from(this.algorithms.keys())
    }

    static getAlgorithmByMimetype(mimetype: string): string {
        if (mimetype.startsWith('image/')) {
            return 'lsb'
        } else if (mimetype.startsWith('audio/')) {
            return 'lsb-audio'
        }
        throw new Error(`No default algorithm for mimetype: ${mimetype}`)
    }

    static isAlgorithmCompatible(algorithm: string, mimetype: string): boolean {
        try {
            const algorithmInstance = this.getAlgorithm(algorithm)
            return algorithmInstance.supportedFormats.includes(mimetype)
        } catch {
            return false
        }
    }
}
