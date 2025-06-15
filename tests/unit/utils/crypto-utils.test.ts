// tests/unit/utils/crypto-utils.test.ts
import { encryptText, decryptText } from '../../../src/utils/crypto-utils'

describe('Crypto Utils', () => {
    const password = 'testpassword123'
    const plaintext = 'Hello World!'

    describe('encryptText', () => {
        test('encrypts text successfully', () => {
            const encrypted = encryptText(plaintext, password)
            expect(encrypted).toBeDefined()
            expect(encrypted).not.toBe(plaintext)
            expect(encrypted).toContain(':')
        })

        test('produces different results for same input', () => {
            const encrypted1 = encryptText(plaintext, password)
            const encrypted2 = encryptText(plaintext, password)
            expect(encrypted1).not.toBe(encrypted2)
        })
    })

    describe('decryptText', () => {
        test('decrypts text successfully', () => {
            const encrypted = encryptText(plaintext, password)
            const decrypted = decryptText(encrypted, password)
            expect(decrypted).toBe(plaintext)
        })

        test('throws error with wrong password', () => {
            const encrypted = encryptText(plaintext, password)
            expect(() => decryptText(encrypted, 'wrongpassword')).toThrow()
        })
    })

    describe('round trip encryption', () => {
        test('encrypt -> decrypt preserves original', () => {
            const original = 'Secret message with special chars: !@#$%'
            const encrypted = encryptText(original, password)
            const decrypted = decryptText(encrypted, password)
            expect(decrypted).toBe(original)
        })

        test('handles empty string', () => {
            const encrypted = encryptText('', password)
            const decrypted = decryptText(encrypted, password)
            expect(decrypted).toBe('')
        })
    })
})
