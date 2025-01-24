import multer from 'multer'
import fs from 'fs'

import { Request, Response } from 'express'
import { extractMessage } from 'src/utils/leastSignificantBit'
import { storage, tempDir } from 'src/utils/storage'

export const upload = multer({ storage })

export default async function (req: Request, res: Response) {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir)
    }

    try {
        const file = req.file
        if (!file) {
            res.status(400).json({ message: 'No file uploaded' })
            return
        }
        const inputPath = file.path
        const text = await extractMessage(inputPath)
        res.json({
            message: 'Text extracted successfully',
            extractedMessage: text,
        })
        fs.unlink(inputPath, () => {})
    } catch (error) {
        console.error('Error uploading file:', error)
        res.status(500).json({ message: 'Server error' })
    }
}
