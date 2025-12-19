import { Controller } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import OpenApiHelper from '../common/OpenApiHelper';
import { SwaggerAuth } from './guard/swagger-auth.guard';

@SwaggerAuth()
@Controller('common')
@ApiTags('Common')
@ApiResponse(OpenApiHelper.responseDoc)
export class CommonController {
  constructor() { }
}


