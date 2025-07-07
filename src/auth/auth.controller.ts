import { Controller, Get } from '@nestjs/common';
import AuthService from './auth.service';
import { BusinessException } from 'src/common/exceptions/custom.exception';

@Controller()
export class AppController {
  constructor(private readonly authService: AuthService) { }

  @Get('/AsrToken')
  async getAsrToken(): Promise<{ token: string }> {
    try {
      const token = await this.authService.generateTempToken(60); // Max value 600
      return { token }
    } catch (error) {
      throw new BusinessException(50001, "Failed to generate token");
    }
  }
}