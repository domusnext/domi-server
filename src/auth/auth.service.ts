import { ConfigService } from '@nestjs/config';
import axios from 'axios';

class AuthService {
    constructor(private configService: ConfigService) {

    }
    async generateTempToken(expiresInSeconds: number) {
        const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: this.configService.get<string>('ASSEMBLYAI_API_KEY'),
                },
            });
            return response.data.token;
        } catch (error) {
            console.error("Error generating temp token:", error.response?.data || error.message);
            throw error;
        }
    }
}

export default AuthService;