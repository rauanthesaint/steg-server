import { DotenvParseOutput, config } from 'dotenv'
import { IConfigService } from './config.interface'

class ConfigService implements IConfigService {
    private config: DotenvParseOutput

    constructor() {
        const { error, parsed } = config()
        if (error) throw new Error('[config] Not found file .env')
        if (!parsed) throw new Error('[config] Empty file .env')
        this.config = parsed
    }

    get(key: string): string {
        const result = this.config[key]
        if (!result) throw new Error('[config] Not existing key')
        return result
    }
}

export default ConfigService
