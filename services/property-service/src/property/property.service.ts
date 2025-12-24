import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import { Property } from './property.entity';
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto';
import { PaginationHelper, PaginatedResponse, PaginationQuery } from '@valentine-efagene/qshelter-common';
import { Amenity } from '../amenity/amenity.entity';
import { PropertyMedia } from '../property-media/property-media.entity';
import { contentType } from 'mime-types';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(PropertyMedia)
    private readonly propertyMediaRepository: Repository<PropertyMedia>,
    private dataSource: DataSource,
  ) { }

  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    const property = new Property()
    property.userId = createPropertyDto.userId
    property.title = createPropertyDto.title
    property.city = createPropertyDto.city
    property.nBathrooms = createPropertyDto.nBathrooms
    property.nBedrooms = createPropertyDto.nBedrooms
    property.nParkingSpots = createPropertyDto.nParkingSpots
    property.price = createPropertyDto.price
    property.country = createPropertyDto.country
    property.streetAddress = createPropertyDto.streetAddress
    property.longitude = createPropertyDto.longitude
    property.latitude = createPropertyDto.latitude
    property.area = createPropertyDto.area

    try {
      // Handle amenities
      const amenities = await this.dataSource.getRepository(Amenity).find()

      const existingTargets = amenities.filter(amenity => createPropertyDto.amenities.includes(amenity.name))
      const newTargets = createPropertyDto.amenities?.filter(amenity => !existingTargets?.map(val => val.name).includes(amenity))

      const createAmenitiesPromises = newTargets?.map(name => {
        const amenity = this.dataSource.getRepository(Amenity).create({ name })
        return queryRunner.manager.save(amenity)
      })

      const newAmenities: Amenity[] = await Promise.all(createAmenitiesPromises)
      const targets: Amenity[] = [...existingTargets, ...newAmenities]

      property.amenities = targets

      const newProperty: Property = await queryRunner.manager.save(property)

      // Create media
      const createMediaPromises = createPropertyDto.gallery?.map((_media) => {
        const media = this.dataSource.getRepository(PropertyMedia).create({
          ..._media,
          property: {
            id: newProperty.id
          }
        })

        return queryRunner.manager.save(media)
      })

      await Promise.all(createMediaPromises)

      await queryRunner.commitTransaction()
      return newProperty
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async findAll(): Promise<Property[]> {
    return this.propertyRepository.find();
  }

  async findAllPaginated(
    query: PaginationQuery,
    location?: string,
  ): Promise<PaginatedResponse<Property>> {
    const page = query.page || 1;
    const limit = PaginationHelper.getLimit(query.limit);
    const skip = PaginationHelper.getSkip(page, limit);

    const whereFilter: FindOptionsWhere<Property> | FindOptionsWhere<Property>[] = location ? [
      { country: Like(`%${location}%`) },
      { streetAddress: Like(`%${location}%`) },
      { city: Like(`%${location}%`) },
      { zipCode: Like(`%${location}%`) },
    ] : {};

    const [items, total] = await this.propertyRepository.findAndCount({
      where: whereFilter,
      relations: ['user', 'media'],
      order: { id: 'DESC' },
      skip,
      take: limit,
    });

    return PaginationHelper.paginate(items, total, query);
  }

  findOne(id: number): Promise<Property> {
    return this.propertyRepository.findOne({
      relations: {
        media: true,
        amenities: true
      },
      where: { id }
    });
  }

  findByTitle(title: string): Promise<Property[]> {
    return this.propertyRepository.find({
      where: {
        title: Like(`%${title}%`)
      }
    });
  }

  async setDisplayImage(propertyId: number, mediaId: number): Promise<Property> {
    const media = await this.propertyMediaRepository.findOne({
      where: {
        id: mediaId,
        propertyId: propertyId
      }
    })

    if (!media) {
      throw new BadRequestException('Media not found')
    }

    const mimeType = contentType(media.url) || ''

    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('Only an image can be used as display image')
    }

    const property = await this.propertyRepository.findOne({
      where: {
        id: propertyId
      }
    })

    if (!property) {
      throw new BadRequestException('Property not found')
    }

    this.propertyRepository.merge(property, {
      displayImageId: mediaId
    })

    return await this.propertyRepository.save(property)
  }

  async updateOne(id: number, { amenities, ...updateDto }: UpdatePropertyDto): Promise<Property> {
    const property = await this.propertyRepository.findOneBy({ id });

    if (!property) {
      throw new NotFoundException(`${Property.name} with ID ${id} not found`);
    }

    this.propertyRepository.merge(property, updateDto);
    return this.propertyRepository.save(property);
  }

  async remove(id: number): Promise<void> {
    await this.propertyRepository.delete(id);
  }
}
