import * as fs from 'fs'
import { PNG } from 'pngjs'

export function messageToBinary(message: string): string[] {
    return message
        .split('')
        .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('')
        .split('')
}

export function binaryToMessage(binaryMessage: string): string {
    const bytes = binaryMessage.match(/.{1,8}/g) || []
    return bytes
        .map((byte: string) => String.fromCharCode(parseInt(byte, 2)))
        .join('')
}

export function setLeastSignificantBit(byte: number, bit: string): number {
    return (byte & 0b11111110) | parseInt(bit)
}

export function getLeastSignificantBit(byte: number): string {
    return (byte & 1).toString()
}

// Внедрение сообщения в изображение
export function embedMessage(
    inputPath: string,
    outputPath: string,
    message: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const png = fs.createReadStream(inputPath).pipe(new PNG())

        png.on('parsed', function () {
            const pixels = this.data // Пиксели изображения
            const binaryMessage = messageToBinary(message)

            if (binaryMessage.length + 32 > pixels.length / 4) {
                // 32 бита = 4 байта на длину
                return reject(
                    new Error(
                        'Сообщение слишком большое для данного изображения.'
                    )
                )
            }

            // Внедряем длину сообщения (4 байта)
            pixels[0] = binaryMessage.length & 0xff
            pixels[1] = (binaryMessage.length >> 8) & 0xff
            pixels[2] = (binaryMessage.length >> 16) & 0xff
            pixels[3] = (binaryMessage.length >> 24) & 0xff

            // Внедряем сообщение
            let messageIndex = 0
            for (let i = 4; i < pixels.length; i += 4) {
                if (messageIndex < binaryMessage.length) {
                    pixels[i] = setLeastSignificantBit(
                        pixels[i],
                        binaryMessage[messageIndex]
                    )
                    messageIndex++
                } else {
                    break
                }
            }

            // Сохраняем новое изображение
            const writeStream = fs.createWriteStream(outputPath)
            this.pack().pipe(writeStream)

            writeStream.on('finish', () => resolve(binaryMessage.join(' ')))
            writeStream.on('error', (err) => reject(err))
        })

        png.on('error', (err) => reject(err))
    })
}

// Извлечение сообщения из изображения
export function extractMessage(inputPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const png = fs.createReadStream(inputPath).pipe(new PNG())

        png.on('parsed', function () {
            const pixels = this.data

            // Извлекаем длину сообщения (4 байта)
            const binaryLength =
                (pixels[3] << 24) |
                (pixels[2] << 16) |
                (pixels[1] << 8) |
                pixels[0]
            console.log(
                `Извлечённая длина сообщения (в битах): ${binaryLength}`
            )

            // Извлекаем сообщение
            const binaryMessage: string[] = []
            for (let i = 4; i < pixels.length; i += 4) {
                if (binaryMessage.length < binaryLength) {
                    binaryMessage.push(getLeastSignificantBit(pixels[i]))
                } else {
                    break
                }
            }

            try {
                const message = binaryToMessage(binaryMessage.join(''))
                resolve(message)
            } catch (error) {
                reject(error)
            }
        })

        png.on('error', (err) => reject(err))
    })
}
