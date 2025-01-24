import multer from 'multer'
import fs from 'fs'

import { Request, Response } from 'express'
import { embedMessage } from 'src/utils/leastSignificantBit'
import path from 'path'
import { storage, tempDir } from 'src/utils/storage'

export const upload = multer({ storage })

export default async function (req: Request, res: Response) {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir)
    }

    try {
        const file = req.file
        const { text } = req.body
        console.log(text)
        if (!file) {
            res.status(400).json({ message: 'No file uploaded' })
            return
        }
        const inputPath = file.path
        const outputPath = path.join(tempDir, `output-${file.filename}`)

        const binary = await embedMessage(inputPath, outputPath, text)

        const fileBuffer = fs.readFileSync(outputPath)
        const base64File = fileBuffer.toString('base64')

        res.json({
            message: 'Text embedded successfully',
            binaryMessage: binary,
            outputFile: base64File,
            filename: `output-${file.filename}`,
            size: file.size,
        })

        fs.unlink(inputPath, () => {})
        fs.unlink(outputPath, () => {})
    } catch (error) {
        console.error('Error uploading file:', error)
        res.status(500).json({ message: 'Server error' })
    }
}
