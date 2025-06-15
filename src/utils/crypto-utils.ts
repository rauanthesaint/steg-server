import crypto from 'crypto'
import { appConfig } from '../config/app.config'
export function encryptText(text: string, password: string): string {
    const algorithm = appConfig.encryptionAlgorithm
    const key = crypto.scryptSync(password, 'salt', 32)
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
}

export function decryptText(encryptedData: string, password: string): string {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(password, 'salt', 32)

    const [ivHex, encrypted] = encryptedData.split(':')
    const iv = Buffer.from(ivHex, 'hex')

    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}
