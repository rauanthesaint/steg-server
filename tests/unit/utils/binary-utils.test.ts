// tests/unit/utils/binary-utils.test.ts
import { textToBinary, binaryToText } from '../../../src/utils/binary-utils'

describe('Binary Utils', () => {
    describe('textToBinary', () => {
        test('converts simple text to binary', () => {
            expect(textToBinary('A')).toBe('01000001')
            expect(textToBinary('AB')).toBe('0100000101000010')
        })

        test('handles empty string', () => {
            expect(textToBinary('')).toBe('')
        })

        test('handles special characters', () => {
            expect(textToBinary('!')).toBe('00100001')
        })
    })

    describe('binaryToText', () => {
        test('converts binary to text', () => {
            expect(binaryToText('01000001')).toBe('A')
            expect(binaryToText('0100000101000010')).toBe('AB')
        })

        test('handles empty string', () => {
            expect(binaryToText('')).toBe('')
        })

        test('handles invalid binary', () => {
            expect(binaryToText('0100001')).toBe('')
        })
    })

    describe('round trip conversion', () => {
        test('text -> binary -> text preserves original', () => {
            const original = 'Hello World!'
            const binary = textToBinary(original)
            const restored = binaryToText(binary)
            expect(restored).toBe(original)
        })
    })
})
