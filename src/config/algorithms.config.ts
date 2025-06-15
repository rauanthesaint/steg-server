// src/config/algorithms.config.ts
export const algorithmsConfig = {
    image: {
        lsb: {
            supportedFormats: ['image/png', 'image/bmp', 'image/tiff'],
            channels: ['rgb'],
            capacity: 'high',
        },
        dct: {
            supportedFormats: ['image/jpeg'],
            quality: 0.8,
            capacity: 'medium',
        },
    },

    audio: {
        lsb: {
            supportedFormats: ['audio/wav'],
            sampleRate: 44100,
            capacity: 'high',
        },
    },

    defaultAlgorithm: 'lsb',
}
