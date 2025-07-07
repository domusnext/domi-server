import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseDto } from './common/dto/response.dto';
import { BusinessException, ValidationException } from './common/exceptions/custom.exception';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('version')
  getVersion(): { version: string; timestamp: string } {
    return this.appService.getVersion();
  }

  @Get('health')
  getHealth(): { status: string; version: string; uptime: number } {
    return this.appService.getHealth();
  }

  // 演示直接返回ResponseDto
  @Get('demo/success')
  getDemoSuccess(): ResponseDto<{ message: string }> {
    return ResponseDto.success(
      { message: 'This is a success response' },
      'Operation completed successfully'
    );
  }

  // 演示自定义业务异常
  @Get('demo/error/:code')
  getDemoError(@Param('code') code: string): never {
    const errorCode = parseInt(code, 10);
    
    switch (errorCode) {
      case 1001:
        throw new BusinessException(1001, '用户不存在');
      case 1002:
        throw new BusinessException(1002, '用户已被禁用');
      case 1003:
        throw new ValidationException('参数验证失败');
      default:
        throw new BusinessException(9999, '未知的业务错误');
    }
  }

  // 演示未预期的异常
  @Get('demo/unexpected')
  getDemoUnexpected(): never {
    throw new Error('This is an unexpected error');
  }

  // 演示条件性响应
  @Get('demo/conditional')
  getDemoConditional(@Query('fail') fail?: string): ResponseDto<string> | string {
    if (fail === 'true') {
      throw new BusinessException(2001, '模拟业务失败');
    }
    
    // 直接返回数据，会被拦截器包装
    return 'This will be wrapped by interceptor';
  }
}