export function textToBinary(text: string): string {
    return text
        .split('')
        .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('')
}

export function binaryToText(binary: string): string {
    return (
        binary
            .match(/.{8}/g)
            ?.map((byte) => String.fromCharCode(parseInt(byte, 2)))
            .join('') || ''
    )
}

export function addMessageHeader(binaryMessage: string): string {
    const messageLength = binaryMessage.length
    const headerBits = messageLength.toString(2).padStart(32, '0')
    return headerBits + binaryMessage
}

export function extractMessageHeader(binaryData: string): {
    length: number
    message: string
} {
    const headerBits = binaryData.substring(0, 32)
    const messageLength = parseInt(headerBits, 2)
    const messageBits = binaryData.substring(32, 32 + messageLength)

    return {
        length: messageLength,
        message: messageBits,
    }
}
