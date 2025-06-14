import multer from 'multer'
import fs from 'fs'
import { Request, Response } from 'express'
import { extractMessage } from 'src/utils/leastSignificantBit'
import { storage, tempDir } from 'src/utils/storage'
import path from 'path'

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
        const extractedText = await extractMessage(inputPath)

        // Create a txt file with the extracted text
        const txtFileName = `extracted-${Date.now()}.txt`
        const txtFilePath = path.join(tempDir, txtFileName)

        // Write the extracted text to a file
        fs.writeFileSync(txtFilePath, extractedText, 'utf8')

        // Read the file as buffer and convert to base64
        const fileBuffer = fs.readFileSync(txtFilePath)
        const base64File = fileBuffer.toString('base64')

        res.status(200).json({
            message: 'Text extracted successfully',
            extractedMessage: extractedText,
            outputFile: base64File,
            filename: txtFileName,
            size: fileBuffer.length,
        })

        // Cleanup
        fs.unlink(inputPath, () => {})
        fs.unlink(txtFilePath, () => {})
    } catch (error) {
        console.error('Error extracting text:', error)
        res.status(500).json({ message: 'Server error' })
    }
}
