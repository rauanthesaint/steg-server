import { Router } from 'express'

import { upload } from 'src/controllers/encrypt'
import { encrypt, decrypt } from 'src/controllers'

const router: Router = Router()

router.post('/encrypt', upload.single('file'), encrypt)
router.post('/decrypt', upload.single('file'), decrypt)
export default router
