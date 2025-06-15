// src/config/file-types.config.ts
export const fileTypesConfig = {
    supported: {
        image: ['image/png', 'image/bmp', 'image/tiff'],
        audio: ['audio/wav'],
        video: ['video/mp4'],
    },

    signatures: {
        'image/png': [0x89, 0x50, 0x4e, 0x47],
        'image/bmp': [0x42, 0x4d],
        'image/tiff': [0x49, 0x49, 0x2a, 0x00],
        'audio/wav': [0x52, 0x49, 0x46, 0x46], // RIFF header
    },

    limits: {
        'image/png': { maxSize: 50 * 1024 * 1024 },
        'image/bmp': { maxSize: 100 * 1024 * 1024 },
        'audio/wav': { maxSize: 200 * 1024 * 1024 }, // 200MB для аудио файлов
    },
}
