import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyDocument } from './property-document.entity';
import {
  CreatePropertyDocumentDto,
} from './property-document.dto';
import {
  DocumentReuploadDto,
  UpdateDocumentDto,
  UpdateDocumentStatusDto,
  DocumentStatus,
  AbstractBaseDocumentEntity,
  S3Folder
} from '@valentine-efagene/qshelter-common';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';

@Injectable()
export class PropertyDocumentService {
  constructor(
    @InjectRepository(PropertyDocument)
    private readonly propertyDocumentRepository: Repository<PropertyDocument>,
    private readonly uploaderService: S3UploaderService,
  ) { }

  async create(
    createPropertyDocumentDto: CreatePropertyDocumentDto,
  ): Promise<PropertyDocument> {
    const { propertyId, ...rest } = createPropertyDocumentDto;
    return this.propertyDocumentRepository.save({
      property: { id: propertyId },
      ...rest,
    });
  }

  async findAll(): Promise<PropertyDocument[]> {
    return this.propertyDocumentRepository.find();
  }

  async findAllByProperty(propertyId: number): Promise<PropertyDocument[]> {
    return await this.propertyDocumentRepository
      .createQueryBuilder()
      .where('property_id = :propertyId', { propertyId })
      .getMany();

    // Example with join
    // return await this.propertyDocumentRepository
    // .createQueryBuilder('propertyDocument')
    // .innerJoin('propertyDocument.property', 'property')
    // .where('property.id = :propertyId', { propertyId })
    // .getMany();
  }

  async findAllByUser(userId: number): Promise<PropertyDocument[]> {
    return await this.propertyDocumentRepository
      .createQueryBuilder('propertyDocument')
      .innerJoin('propertyDocument.property', 'property')
      .innerJoin('property.user', 'user')
      .where('user.id = :userId', { userId })
      .getMany();
  }

  findOne(id: number): Promise<PropertyDocument> {
    return this.propertyDocumentRepository.findOneBy({ id: id });
  }

  async updateOne(
    id: number,
    updateDto: UpdateDocumentDto & { size?: number, status?: DocumentStatus },
  ): Promise<PropertyDocument> {
    const propertyDocument = await this.propertyDocumentRepository.findOneBy({ id });

    if (!propertyDocument) {
      throw new NotFoundException(
        `${PropertyDocument.name} with ID ${id} not found`,
      );
    }

    this.propertyDocumentRepository.merge(propertyDocument, updateDto);
    return this.propertyDocumentRepository.save(propertyDocument);
  }

  async remove(id: number): Promise<void> {
    const document = await this.propertyDocumentRepository.findOneBy({ id });

    if (document.url) {
      await this.uploaderService.deleteFromS3((await document).url);
    }
    await this.propertyDocumentRepository.delete(id);
  }

  async updateStatus(
    id: number,
    updateDto: UpdateDocumentStatusDto,
  ): Promise<PropertyDocument> {
    if (updateDto.status === DocumentStatus.DECLINED && !updateDto.comment) {
      throw new BadRequestException('Please provide a reason for declining')
    }

    const proposedDevelopment =
      await this.propertyDocumentRepository.findOneBy({
        id,
      });

    if (!proposedDevelopment) {
      throw new NotFoundException(
        `${PropertyDocument.name} with ID ${id} not found`,
      );
    }

    const { reviewerId, status } = updateDto;

    this.propertyDocumentRepository.merge(proposedDevelopment, {
      ...updateDto,
      reviewer: { id: reviewerId },
      reviewedAt:
        status === DocumentStatus.APPROVED ? new Date().toISOString() : null,
    });
    return this.propertyDocumentRepository.save(proposedDevelopment);
  }

  async reupload(file: Express.Multer.File,
    dto: DocumentReuploadDto,
  ): Promise<
    AbstractBaseDocumentEntity
  > {
    const { id, ...rest } = dto
    const size = file.size
    let oldDocument = null
    let newUrl = null

    oldDocument = await this.findOne(id)

    if (!oldDocument) {
      throw new BadRequestException('Invalid document ID')
    }

    newUrl = await this.uploaderService.replaceFileOnS3(
      file,
      S3Folder.DOCUMENT,
      oldDocument.url,
    );
    return await this.updateOne(id, {
      url: newUrl,
      size,
      status: DocumentStatus.PENDING,
      ...rest
    })
  }
}
