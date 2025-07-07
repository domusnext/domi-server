export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

export class ResponseDto<T = any> implements ApiResponse<T> {
  code: number;
  message: string;
  data?: T;

  constructor(code: number = 0, message: string = 'success', data?: T) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  static success<T>(data?: T, message: string = 'success'): ResponseDto<T> {
    return new ResponseDto(0, message, data);
  }

  static error(code: number = 500, message: string = 'Internal Server Error'): ResponseDto {
    return new ResponseDto(code, message);
  }
} 