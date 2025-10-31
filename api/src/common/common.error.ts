// custom-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html#error_er_no_referenced_row
@Catch(QueryFailedError)
export class QueryFailedFilter implements ExceptionFilter {
  //catch(exception: QueryFailedError, host: ArgumentsHost) {
  catch(exception: any, host: ArgumentsHost) {
    console.log(exception) // To get the error code
    const response = host.switchToHttp().getResponse();
    switch (exception.code) {
      case 'ER_DUP_ENTRY':
        // Duplicate entry error
        response.status(HttpStatus.CONFLICT).json({
          message: 'Duplicate entry',
          error: exception.message,
          statusCode: HttpStatus.CONFLICT,
        });
        break;

      case 'ER_NO_REFERENCED_ROW':
        // Foreign key conflict
        response.status(HttpStatus.CONFLICT).json({
          message: 'Foreign Key Conflict',
          error: exception.message,
          statusCode: HttpStatus.CONFLICT,
        });
        break;

      case 'ER_NO_REFERENCED_ROW_2':
        // Foreign key conflict
        response.status(HttpStatus.CONFLICT).json({
          message: 'Foreign Key Conflict',
          error: exception.message,
          statusCode: HttpStatus.CONFLICT,
        });
        break;

      default:
        // Handle other errors
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Internal server error',
          error: exception.message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
        break;
    }
  }
}
