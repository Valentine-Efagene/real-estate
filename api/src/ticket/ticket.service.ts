import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import { Ticket } from './ticket.entity';
import { CreateTicketDto, TicketReassignmentDto, UpdateTicketDto } from './ticket.dto';
import { FilterOperator, PaginateQuery, Paginated, paginate } from 'nestjs-paginate';
import { User } from '../user/user.entity';
import { Request } from 'express';
import { QrCodeService } from '../qr-code/qr-code.service';
import { EventTicketType } from '../event-ticket-type/event-ticket-type.entity';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';
import { TicketAuditLog } from '../ticket-audit-log/ticket-audit-log.entity';
import { TicketAuditAction } from '../ticket-audit-log/ticket-audit-log.enums';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly qrCodeService: QrCodeService,
    private readonly dataSource: DataSource,
    private readonly s3UploaderService: S3UploaderService,

    @InjectRepository(TicketAuditLog)
    private readonly ticketAuditLogRepository: Repository<TicketAuditLog>,
  ) { }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    const ticketType = await this.dataSource.getRepository(EventTicketType).findOne({
      where: { id: createTicketDto.eventTicketTypeId }
    })

    if (!ticketType) {
      throw new NotFoundException(`Event Ticket Type with ID ${createTicketDto.eventTicketTypeId} not found`);
    }

    const ticketTypeCount = await this.ticketRepository.count({
      where: {
        eventTicketTypeId: createTicketDto.eventTicketTypeId,
      }
    })

    const ticketTypeCountForThisUser = await this.ticketRepository.count({
      where: {
        eventTicketTypeId: createTicketDto.eventTicketTypeId,
        userId: createTicketDto.userId,
      }
    })

    // Check if the ticket type has reached its capacity
    if (ticketTypeCount >= ticketType.capacity) {
      throw new BadRequestException(`No more tickets available for this event type.`);
    }

    // Check if the user has reached the maximum number of tickets for this event type
    if (ticketTypeCountForThisUser >= ticketType.maxTicketsPerUser) {
      throw new BadRequestException(`You have reached the maximum number of tickets for this event type.`);
    }

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    const ticket = new Ticket()
    ticket.userId = createTicketDto.userId
    ticket.eventTicketTypeId = createTicketDto.eventTicketTypeId

    try {
      const newTicket: Ticket = await queryRunner.manager.save(ticket)

      // Commit the transaction
      await queryRunner.commitTransaction()
      return newTicket
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async reassign(id: number, dto: TicketReassignmentDto, request: Request): Promise<Ticket> {
    const user: User = request['user'] as User
    const ticket = await this.ticketRepository.findOne({
      where: { id }
    })

    if (!ticket) {
      throw new BadRequestException(`Ticket with ID ${id} not found`)
    }

    if (!user || user.id !== ticket.userId) {
      throw new UnauthorizedException('You are not authorized to reassign this ticket')
    }

    if (ticket.resassignCount > 0) {
      throw new BadRequestException('This ticket has already been reassigned once.')
    }

    const { guestFirstName, guestLastName, guestEmail, guestPhone } = dto

    const issuedAt = new Date()
    const nonce = this.qrCodeService.generateNonce()

    const verificationToken = this.qrCodeService.encryptPayload({
      firstName: guestFirstName,
      lastName: guestLastName,
      nonce,
    })

    const qrCodeImage = await this.qrCodeService.convertToImage(verificationToken)
    const url = await this.s3UploaderService.uploadBase64ImageToS3(qrCodeImage, `qrcode/${nonce}.png`)

    if (ticket.qrCodeImage) {
      await this.s3UploaderService.deleteFromS3(ticket.qrCodeImage)
    }

    try {
      const updatedTicket = this.ticketRepository.merge(ticket, {
        guestEmail,
        guestFirstName,
        guestLastName,
        guestPhone,
        resassignCount: ticket.resassignCount + 1,
        issuedAt,
        nonce,
        verificationToken,
        qrCodeImage: url,
      })

      const updated = await this.ticketRepository.save(updatedTicket)
      const log = this.ticketAuditLogRepository.create({
        action: TicketAuditAction.REASSIGN,
        before: JSON.stringify(ticket),
        after: JSON.stringify(updated),
        ticketId: ticket.id,
      })
      await this.ticketAuditLogRepository.save(log)
      return updated
    } catch (error) {
      await this.s3UploaderService.deleteFromS3(url)
      throw error
    }
  }

  async findAll(): Promise<Ticket[]> {
    return this.ticketRepository.find();
  }

  findAllPaginated(
    query: PaginateQuery,
  ): Promise<Paginated<Ticket>> {
    const whereFilter: FindOptionsWhere<Ticket> | FindOptionsWhere<Ticket>[] = [
    ]

    return paginate(query, this.ticketRepository, {
      sortableColumns: ['id', 'createdAt', 'updatedAt'],
      //nullSort: 'last',
      defaultSortBy: [['id', 'DESC']],
      loadEagerRelations: true,
      relations: ['user', 'media'],
      searchableColumns: ['user.firstName', 'user.lastName', 'user.email'],
      //select: ['id'],
      where: whereFilter,
      filterableColumns: {
        //name: [FilterOperator.EQ, FilterSuffix.NOT],
        price: [FilterOperator.LTE],
        ticketCategory: true,
        category: true,
        status: true,
        createdAt: true
      },
    });
  }

  findOwnPaginated(
    query: PaginateQuery, req: Request
  ): Promise<Paginated<Ticket>> {
    const user = req['user'] as User

    if (!user) {
      throw new UnauthorizedException()
    }

    const whereFilter: FindOptionsWhere<Ticket> | FindOptionsWhere<Ticket>[] = [
    ]

    return paginate(query, this.ticketRepository, {
      sortableColumns: ['id', 'createdAt', 'updatedAt'],
      //nullSort: 'last',
      defaultSortBy: [['id', 'DESC']],
      loadEagerRelations: true,
      relations: [
        'eventTicketType',
        'eventTicketType.event'
      ],
      searchableColumns: ['user.firstName', 'user.lastName', 'user.email'],
      //select: ['id'],
      where: {
        userId: user.id
      },
      filterableColumns: {
        //name: [FilterOperator.EQ, FilterSuffix.NOT],
        price: [FilterOperator.LTE],
        ticketCategory: true,
        category: true,
        status: true,
        createdAt: true
      },
    });
  }

  async findAllByUserPaginated(
    userId: number,
    query: PaginateQuery,
  ): Promise<Paginated<Ticket>> {
    return paginate(query, this.ticketRepository, {
      sortableColumns: ['id', 'createdAt', 'updatedAt'],
      //nullSort: 'last',
      defaultSortBy: [['id', 'DESC']],
      loadEagerRelations: true,
      relations: [],
      searchableColumns: ['user.firstName', 'user.lastName', 'user.email'],
      //select: ['id'],
      where: {
        userId
      },
      filterableColumns: {
        //name: [FilterOperator.EQ, FilterSuffix.NOT],
        price: [FilterOperator.LTE],
        ticketCategory: true,
        category: true,
        status: true,
        createdAt: true
      },
    });
  }

  findOne(id: number): Promise<Ticket> {
    return this.ticketRepository.findOne({
      relations: {
        eventTicketType: true
      },
      where: { id }
    });
  }

  async updateOne(id: number, updateDto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOneBy({ id });

    if (!ticket) {
      throw new NotFoundException(`${Ticket.name} with ID ${id} not found`);
    }

    this.ticketRepository.merge(ticket, updateDto);
    return this.ticketRepository.save(ticket);
  }

  async remove(id: number): Promise<void> {
    await this.ticketRepository.delete(id);
  }
}
