import multer from 'multer'
import path from 'path'

export const tempDir = path.resolve('temp')
export const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir)
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`)
    },
})
