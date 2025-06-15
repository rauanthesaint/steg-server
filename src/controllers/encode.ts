import multer from 'multer'
import fs from 'fs'

import { Request, Response } from 'express'
import path from 'path'
import { storage, tempDir } from 'src/utils/storage'
import { getAvailableAlgorithms, getFileType } from 'src/utils/file'

export const upload = multer({ storage })

export default async function (req: Request, res: Response) {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir)
    }

    try {
        const file = req.file
        const { text } = req.body

        if (!file) {
            res.status(400).json({ message: 'No file uploaded' })
            return
        }

        if (!text) {
            res.status(400).json({
                message: 'No message text provided',
            })
        }

        const { filename, mimetype, size } = file
        const inputPath = file.path
        const outputPath = path.join(tempDir, `output-${file.filename}`)

        const fileType = getFileType(mimetype)
        const availableAlgorithms = getAvailableAlgorithms(fileType)

        const selectedAlgorithm = availableAlgorithms[0]

        // const binary = await embedMessage(inputPath, outputPath, text)

        // const fileBuffer = fs.readFileSync(outputPath)
        // const base64File = fileBuffer.toString('base64')

        console.log(file, text)

        res.status(200).json({
            // message: 'Text embedded successfully',
            // binaryMessage: binary,
            // outputFile: base64File,
            // filename: `output-${file.filename}`,
            // size: file.size,
            size,
            filename,
            mimetype,
        })

        fs.unlink(inputPath, () => {})
        fs.unlink(outputPath, () => {})
    } catch (error) {
        console.error('Error uploading file:', error)
        res.status(500).json({ message: 'Server error' })
    }
}
