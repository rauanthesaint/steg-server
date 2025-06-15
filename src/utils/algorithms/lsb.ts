import * as fs from 'fs'
import { PNG } from 'pngjs'

const HEADER_SIZE_BITS = 32 // 32 бита для длины сообщения
const DELIMITER = '\0' // Разделитель конца сообщения

export function messageToBinary(message: string): string[] {
    const fullMessage = message + DELIMITER
    return fullMessage
        .split('')
        .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('')
        .split('')
}

export function binaryToMessage(binaryMessage: string): string {
    const bytes = binaryMessage.match(/.{1,8}/g) || []
    const message = bytes
        .map((byte: string) => String.fromCharCode(parseInt(byte, 2)))
        .join('')

    // Удаляем разделитель и всё после него
    return message.split(DELIMITER)[0]
}

export function setLeastSignificantBit(byte: number, bit: string): number {
    return (byte & 0b11111110) | parseInt(bit)
}

export function getLeastSignificantBit(byte: number): string {
    return (byte & 1).toString()
}

// Преобразование числа в массив битов
function numberToBits(num: number, bitCount: number): string[] {
    const bits: string[] = []
    for (let i = bitCount - 1; i >= 0; i--) {
        bits.push(((num >> i) & 1).toString())
    }
    return bits
}

// Преобразование массива битов в число
function bitsToNumber(bits: string[]): number {
    let num = 0
    for (const bit of bits) {
        num = (num << 1) | parseInt(bit)
    }
    return num
}

// Получение доступных RGB пикселей (пропуская альфа-канал)
function getRGBIndices(totalPixels: number): number[] {
    const indices: number[] = []
    for (let i = 0; i < totalPixels; i += 4) {
        indices.push(i, i + 1, i + 2) // R, G, B (пропускаем A)
    }
    return indices
}

// Внедрение сообщения в изображение
export function LSBEncode(
    inputPath: string,
    outputPath: string,
    message: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Проверка существования входного файла
        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Файл не найден: ${inputPath}`))
        }

        const png = fs.createReadStream(inputPath).pipe(new PNG())

        png.on('parsed', function () {
            const pixels = this.data
            const binaryMessage = messageToBinary(message)

            // Получаем индексы RGB каналов
            const rgbIndices = getRGBIndices(pixels.length)
            const totalBitsNeeded = HEADER_SIZE_BITS + binaryMessage.length

            if (totalBitsNeeded > rgbIndices.length) {
                return reject(
                    new Error(
                        `Сообщение слишком большое. Нужно ${totalBitsNeeded} битов, доступно ${rgbIndices.length}.`
                    )
                )
            }

            let bitIndex = 0

            // Внедряем длину сообщения в первые 32 бита
            const lengthBits = numberToBits(
                binaryMessage.length,
                HEADER_SIZE_BITS
            )
            for (let i = 0; i < lengthBits.length; i++) {
                const pixelIndex = rgbIndices[bitIndex]
                pixels[pixelIndex] = setLeastSignificantBit(
                    pixels[pixelIndex],
                    lengthBits[i]
                )
                bitIndex++
            }

            // Внедряем само сообщение
            for (let i = 0; i < binaryMessage.length; i++) {
                const pixelIndex = rgbIndices[bitIndex]
                pixels[pixelIndex] = setLeastSignificantBit(
                    pixels[pixelIndex],
                    binaryMessage[i]
                )
                bitIndex++
            }

            // Сохраняем новое изображение
            const writeStream = fs.createWriteStream(outputPath)
            this.pack().pipe(writeStream)

            writeStream.on('finish', () => {
                resolve(
                    `Сообщение успешно встроено. Использовано ${bitIndex} битов из ${rgbIndices.length} доступных.`
                )
            })

            writeStream.on('error', (err) => reject(err))
        })

        png.on('error', (err) => reject(err))
    })
}

// Извлечение сообщения из изображения
export function LSBDecode(inputPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        // Проверка существования входного файла
        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Файл не найден: ${inputPath}`))
        }

        const png = fs.createReadStream(inputPath).pipe(new PNG())

        png.on('parsed', function () {
            const pixels = this.data
            const rgbIndices = getRGBIndices(pixels.length)

            if (rgbIndices.length < HEADER_SIZE_BITS) {
                return reject(
                    new Error(
                        'Изображение слишком маленькое для извлечения сообщения.'
                    )
                )
            }

            let bitIndex = 0

            // Извлекаем длину сообщения из первых 32 битов
            const lengthBits: string[] = []
            for (let i = 0; i < HEADER_SIZE_BITS; i++) {
                const pixelIndex = rgbIndices[bitIndex]
                lengthBits.push(getLeastSignificantBit(pixels[pixelIndex]))
                bitIndex++
            }

            const messageLength = bitsToNumber(lengthBits)

            console.log(
                `Извлечённая длина сообщения (в битах): ${messageLength}`
            )

            // Проверяем корректность длины
            if (
                messageLength <= 0 ||
                messageLength > rgbIndices.length - HEADER_SIZE_BITS
            ) {
                return reject(
                    new Error(
                        'Некорректная длина сообщения или сообщение отсутствует.'
                    )
                )
            }

            // Извлекаем само сообщение
            const binaryMessage: string[] = []
            for (let i = 0; i < messageLength; i++) {
                const pixelIndex = rgbIndices[bitIndex]
                binaryMessage.push(getLeastSignificantBit(pixels[pixelIndex]))
                bitIndex++
            }

            try {
                const message = binaryToMessage(binaryMessage.join(''))
                resolve(message)
            } catch (error) {
                reject(
                    new Error(
                        `Ошибка декодирования сообщения: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    )
                )
            }
        })

        png.on('error', (err) => reject(err))
    })
}

// Вычисление максимальной емкости изображения
export function getImageCapacity(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Файл не найден: ${inputPath}`))
        }

        const png = fs.createReadStream(inputPath).pipe(new PNG())

        png.on('parsed', function () {
            const pixels = this.data
            const rgbIndices = getRGBIndices(pixels.length)
            const availableBits = rgbIndices.length - HEADER_SIZE_BITS
            const maxBytes = Math.floor(availableBits / 8)

            resolve(maxBytes)
        })

        png.on('error', (err) => reject(err))
    })
}

// Проверка возможности встраивания сообщения
export function canEmbedMessage(
    inputPath: string,
    message: string
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        getImageCapacity(inputPath)
            .then((capacity) => {
                const messageBytes = new TextEncoder().encode(
                    message + DELIMITER
                )
                resolve(messageBytes.length <= capacity)
            })
            .catch(reject)
    })
}
