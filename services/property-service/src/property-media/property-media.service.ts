import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyMedia } from './property-media.entity';
import {
  CreatePropertyMediaDto,
} from './property-media.dto';
import {
  DocumentReuploadDto,
  UpdateDocumentDto,
  UpdateDocumentStatusDto,
} from '../common/common.dto';
import { DocumentStatus } from '../common/common.type';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';
import { AbstractBaseMediaEntity } from '../common/common.entity';
import { S3Folder } from '../common/common.enum';

@Injectable()
export class PropertyMediaService {
  constructor(
    @InjectRepository(PropertyMedia)
    private readonly PropertyMediaRepository: Repository<PropertyMedia>,
    private readonly uploaderService: S3UploaderService,
  ) { }

  async create(
    createPropertyMediaDto: CreatePropertyMediaDto,
  ): Promise<PropertyMedia> {
    const { propertyId, ...rest } = createPropertyMediaDto;
    return this.PropertyMediaRepository.save({
      event: { id: propertyId },
      ...rest,
    });
  }

  async findAll(): Promise<PropertyMedia[]> {
    return this.PropertyMediaRepository.find();
  }

  async findAllByProperty(propertyId: number): Promise<PropertyMedia[]> {
    return await this.PropertyMediaRepository
      .createQueryBuilder()
      .where('property_id = :propertyId', { propertyId })
      .getMany();
  }

  async findAllByUser(userId: number): Promise<PropertyMedia[]> {
    return await this.PropertyMediaRepository
      .createQueryBuilder('PropertyMedia')
      .innerJoin('PropertyMedia.event', 'event')
      .innerJoin('event.user', 'user')
      .where('user.id = :userId', { userId })
      .getMany();
  }

  async findOne(id: number): Promise<PropertyMedia> {
    const data = await this.PropertyMediaRepository.findOneBy({ id });

    if (!data) {
      throw new NotFoundException()
    }

    return data
  }

  async updateOne(
    id: number,
    updateDto: UpdateDocumentDto & { size?: number, status?: DocumentStatus },
  ): Promise<PropertyMedia> {
    const PropertyMedia = await this.PropertyMediaRepository.findOneBy({ id });

    if (!PropertyMedia) {
      throw new NotFoundException(
        `${PropertyMedia.name} with ID ${id} not found`,
      );
    }

    this.PropertyMediaRepository.merge(PropertyMedia, updateDto);
    return this.PropertyMediaRepository.save(PropertyMedia);
  }

  async remove(id: number): Promise<void> {
    const document = await this.PropertyMediaRepository.findOneBy({ id });

    if (document.url) {
      await this.uploaderService.deleteFromS3(document.url);
    }
    await this.PropertyMediaRepository.delete(id);
  }

  async updateStatus(
    id: number,
    updateDto: UpdateDocumentStatusDto,
  ): Promise<PropertyMedia> {
    if (updateDto.status === DocumentStatus.DECLINED && !updateDto.comment) {
      throw new BadRequestException('Please provide a reason for declining')
    }

    const proposedDevelopment =
      await this.PropertyMediaRepository.findOneBy({
        id,
      });

    if (!proposedDevelopment) {
      throw new NotFoundException(
        `${PropertyMedia.name} with ID ${id} not found`,
      );
    }

    const { reviewerId, status } = updateDto;

    this.PropertyMediaRepository.merge(proposedDevelopment, {
      ...updateDto,
      reviewer: { id: reviewerId },
      reviewedAt:
        status === DocumentStatus.APPROVED ? new Date().toISOString() : null,
    });
    return this.PropertyMediaRepository.save(proposedDevelopment);
  }

  // async reupload(
  //   dto: DocumentReuploadDto,
  // ): Promise<
  //   AbstractBaseMediaEntity
  // > {
  //   const { id, ...rest } = dto
  //   const size = file.size
  //   let oldMedia = null
  //   let newUrl = null

  //   oldMedia = await this.findOne(id)

  //   if (!oldMedia) {
  //     throw new BadRequestException('Invalid document ID')
  //   }

  //   newUrl = await this.uploaderService.replaceFileOnS3(
  //     file,
  //     S3Folder.DOCUMENT,
  //     oldMedia.url,
  //   );
  //   return await this.updateOne(id, {
  //     url: newUrl,
  //     size,
  //     status: DocumentStatus.PENDING,
  //     ...rest
  //   })
  // }
}
