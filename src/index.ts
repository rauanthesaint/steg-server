import express, { Express, Request, Response } from 'express'
import ConfigService from './config/config.class'
import cors from 'cors'
import { router } from './routes'

const application: Express = express()
const configService = new ConfigService()

const port = configService.get('PORT') || 5000

// Apply CORS middleware
application.use(
    cors({
        origin: '*', // Adjust the origin as needed for security
        credentials: true,
        methods: 'PUT, POST, GET, DELETE, PATCH, OPTIONS',
        allowedHeaders: 'Content-Type',
        maxAge: 1800,
    })
)

application.use(express.json())
application.use('/api', router)
application.get('/', (req: Request, res: Response, next) => {
    res.send('Hi')
})

application.listen(port, () => {
    console.log(`[Server]: Running at http://localhost:${port}`)
})
