// src/base/algorithm.factory.ts
import { SteganographyAlgorithm } from './algorithm.interface'
import { LSBEncoder } from '../image/lsb-image.algorithm'

export class AlgorithmFactory {
    private static algorithms = new Map<string, () => SteganographyAlgorithm>([
        ['lsb', () => new LSBEncoder()],
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
}
