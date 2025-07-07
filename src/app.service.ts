import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getVersion(): { version: string; timestamp: string } {
    return {
      version: process.env.APP_VERSION || 'unknown',
      timestamp: new Date().toISOString()
    };
  }

  getHealth(): { status: string; version: string; uptime: number } {
    return {
      status: 'healthy',
      version: process.env.APP_VERSION || 'unknown',
      uptime: process.uptime()
    };
  }
}
