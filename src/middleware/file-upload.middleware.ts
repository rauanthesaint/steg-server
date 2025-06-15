// src/middleware/file-upload.middleware.ts
import multer from 'multer'
import { Request, Response, NextFunction } from 'express'
import path from 'path'
import { detectFileFormat } from '../utils/format-detector'
import { isSupportedFormat } from '../utils/file-utils'
import { appConfig } from '../config/app.config'

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, appConfig.uploadsDir)
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(
            Math.random() * 1e9
        )}${path.extname(file.originalname)}`
        cb(null, uniqueName)
    },
})

const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    if (isSupportedFormat(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error('Unsupported file format'))
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: appConfig.maxFileSize,
        files: 1,
    },
})

export const fileUploadMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message })
        }

        if (req.file) {
            try {
                // Дополнительная проверка формата
                const detectedFormat = await detectFileFormat(req.file.path)
                if (detectedFormat !== req.file.mimetype) {
                    return res
                        .status(400)
                        .json({ error: 'File format mismatch' })
                }
            } catch (error) {
                return res.status(400).json({ error: 'Invalid file' })
            }
        }

        next()
    })
}
