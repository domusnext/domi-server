import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseDto } from '../dto/response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseDto<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果返回的数据已经是ResponseDto格式，直接返回
        if (data instanceof ResponseDto) {
          return data;
        }
        
        // 如果数据是对象且包含code字段，认为是已格式化的响应
        if (data && typeof data === 'object' && 'code' in data) {
          return data as ResponseDto<T>;
        }
        
        // 否则包装为成功响应
        return ResponseDto.success(data);
      }),
    );
  }
} 