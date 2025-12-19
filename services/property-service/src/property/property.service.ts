import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import { Property } from './property.entity';
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto';
import { FilterOperator, PaginateQuery, Paginated, paginate } from 'nestjs-paginate';
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

  findAllPaginated(
    query: PaginateQuery,
    location?: string,
  ): Promise<Paginated<Property>> {
    const whereFilter: FindOptionsWhere<Property> | FindOptionsWhere<Property>[] = [
      { country: Like(`%${location}%`) },
      { streetAddress: Like(`%${location}%`) },
      { city: Like(`%${location}%`) },
      { zipCode: Like(`%${location}%`) },
    ]

    return paginate(query, this.propertyRepository, {
      sortableColumns: ['id', 'title', 'createdAt', 'updatedAt'],
      //nullSort: 'last',
      defaultSortBy: [['id', 'DESC']],
      loadEagerRelations: true,
      relations: ['user', 'media'],
      searchableColumns: ['title', 'user.firstName', 'user.lastName', 'user.email'],
      //select: ['id'],
      where: location ? whereFilter : undefined,
      filterableColumns: {
        //name: [FilterOperator.EQ, FilterSuffix.NOT],
        price: [FilterOperator.LTE],
        propertyType: true,
        category: true,
        status: true,
        createdAt: true
      },
    });
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
