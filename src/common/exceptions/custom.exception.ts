import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomException extends HttpException {
  private readonly errorCode: number;

  constructor(
    code: number,
    message: string,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, httpStatus);
    this.errorCode = code;
  }

  getErrorCode(): number {
    return this.errorCode;
  }
}

// 常用的业务异常
export class BusinessException extends CustomException {
  constructor(code: number, message: string) {
    super(code, message, HttpStatus.BAD_REQUEST);
  }
}

// 参数验证异常
export class ValidationException extends CustomException {
  constructor(message: string = '参数验证失败') {
    super(400, message, HttpStatus.BAD_REQUEST);
  }
}

// 未授权异常
export class UnauthorizedException extends CustomException {
  constructor(message: string = '未授权访问') {
    super(401, message, HttpStatus.UNAUTHORIZED);
  }
}

// 资源不存在异常
export class NotFoundException extends CustomException {
  constructor(message: string = '资源不存在') {
    super(404, message, HttpStatus.NOT_FOUND);
  }
} 