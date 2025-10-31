import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
  Query,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common';
import { Ticket } from './ticket.entity';
import { TicketService } from './ticket.service';
import { CreateTicketDto, TicketReassignmentDto } from './ticket.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';
import { Paginate, PaginateQuery, Paginated } from 'nestjs-paginate';
import { Request, Response } from 'express';
import { QrCodeService } from '../qr-code/qr-code.service';

@SwaggerAuth()
@Controller('tickets')
@ApiTags('Ticket')
@ApiResponse(OpenApiHelper.responseDoc)
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly qrCodeService: QrCodeService,
  ) { }

  @ApiQuery({
    name: 'title',
    type: 'string',
    example: '',
    required: false,
    description: 'The title of the ticket'
  })
  @ApiQuery({
    name: 'search',
    type: 'string',
    example: '',
    description: 'Can search by multiple fields: email of poster, title of ticket, first name of poster, last name of poster',
    required: false,
  })
  @ApiQuery({
    name: 'category',
    type: 'string',
    example: '',
    description: '',
    required: false,
  })
  @ApiQuery({
    name: 'ticketCategory',
    type: 'string',
    example: '',
    required: false,
    description: ''
  })
  @ApiQuery({
    name: 'location',
    type: 'string',
    example: '',
    required: false,
    description: 'Will search across all location fields'
  })
  @ApiQuery({
    name: 'price',
    type: 'string',
    example: '',
    required: false,
    description: 'Less than or equal to'
  })
  @Get('paginate')
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAllPaginated(
    @Paginate() query: PaginateQuery,
  ): Promise<StandardApiResponse<Paginated<Ticket>>> {
    const data = await this.ticketService.findAllPaginated(query);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get('own')
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findOwnPaginated(
    @Paginate() query: PaginateQuery,
    @Req() req: Request
  ): Promise<StandardApiResponse<Paginated<Ticket>>> {
    const data = await this.ticketService.findOwnPaginated(query, req);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Post()
  async create(
    @Body() createTicketDto: CreateTicketDto,
  ): Promise<StandardApiResponse<Ticket>> {
    const data = await this.ticketService.create(createTicketDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Ticket>> {
    const data = await this.ticketService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @HttpCode(HttpStatus.OK)
  @Post(':id/reassign')
  @ApiResponse(OpenApiHelper.responseDoc)
  async reassign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TicketReassignmentDto,
    @Req() request: Request,
  ): Promise<StandardApiResponse<Ticket>> {
    const data = await this.ticketService.reassign(id, dto, request);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @Get(':id/qr')
  async getTicketQR(
    @Param('code') ticketId: number,
    @Res() res: Response,
  ) {
    const ticket = await this.ticketService.findOne(ticketId);
    if (!ticket) {
      return res.status(HttpStatus.NOT_FOUND).send('Ticket not found');
    }

    const qrCode = this.qrCodeService.convertToImage(ticket.verificationToken);

    if (!qrCode) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to generate QR code');
    }

    res.setHeader('Content-Type', 'image/png');
    return res.send(qrCode);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.ticketService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  //@RequirePermission(PermissionsEnum.CAN_LIST_USERS)
  async findAll(): Promise<StandardApiResponse<Ticket[]>> {
    const data = await this.ticketService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}
