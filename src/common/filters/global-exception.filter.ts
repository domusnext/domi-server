import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomException } from '../exceptions/custom.exception';
import { ResponseDto } from '../dto/response.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 500;
    let message = 'Internal Server Error';

    // 处理自定义异常
    if (exception instanceof CustomException) {
      status = exception.getStatus();
      code = exception.getErrorCode();
      message = exception.message;
    }
    // 处理HTTP异常
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status;
      message = exception.message;
    }
    // 处理未预期的异常
    else {
      // 记录未预期的异常
      this.logger.error(
        `Unexpected error occurred: ${exception}`,
        (exception as Error).stack,
        `${request.method} ${request.url}`,
      );
      
      // 生产环境隐藏详细错误信息
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal Server Error';
      } else {
        message = (exception as Error).message || 'Internal Server Error';
      }
    }

    const errorResponse = ResponseDto.error(code, message);

    // 记录错误日志
    this.logger.error(
      `HTTP ${status} Error: ${message}`,
      null,
      `${request.method} ${request.url}`,
    );

    response.status(status).json(errorResponse);
  }
} 