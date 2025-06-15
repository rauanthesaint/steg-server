import { Router } from 'express'

import { upload } from 'src/controllers/encrypt'
import { encrypt, decrypt } from 'src/controllers'
import encode from 'src/controllers/encode'

const router: Router = Router()

router.post('/encrypt', upload.single('file'), encrypt)
router.post('/decrypt', upload.single('file'), decrypt)
router.post('/encode', upload.single('file'), encode)
export default router
