import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import { Settings } from './settings.entity';
import { CreatePropertyDto, UpdatePropertyDto } from './settings.dto';
import { FilterOperator, PaginateQuery, Paginated, paginate } from 'nestjs-paginate';

@Injectable()
export class SettingsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
  ) { }

  async create(createPropertyDto: CreatePropertyDto): Promise<Settings> {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    const event = new Settings()
    event.createdBy = createPropertyDto.userId
    event.title = createPropertyDto.title

    try {
      const newSettings: Settings = await queryRunner.manager.save(event)

      await queryRunner.commitTransaction()
      return newSettings
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async findAll(): Promise<Settings[]> {
    return this.settingsRepository.find();
  }

  findAllPaginated(
    query: PaginateQuery,
    location?: string,
  ): Promise<Paginated<Settings>> {
    const whereFilter: FindOptionsWhere<Settings> | FindOptionsWhere<Settings>[] = [
    ]

    return paginate(query, this.settingsRepository, {
      sortableColumns: ['id', 'title', 'createdAt', 'updatedAt'],
      //nullSort: 'last',
      defaultSortBy: [['id', 'DESC']],
      loadEagerRelations: true,
      relations: ['user', 'media'],
      searchableColumns: ['title'],
      //select: ['id'],
      where: location ? whereFilter : undefined,
      filterableColumns: {
        //name: [FilterOperator.EQ, FilterSuffix.NOT],
        price: [FilterOperator.LTE],
        settingsType: true,
        category: true,
        status: true,
        createdAt: true
      },
    });
  }

  findOne(id: number): Promise<Settings> {
    return this.settingsRepository.findOne({
      relations: {
        media: true,
      },
      where: { id }
    });
  }

  findByTitle(title: string): Promise<Settings[]> {
    return this.settingsRepository.find({
      where: {
        title: Like(`%${title}%`)
      }
    });
  }

  async updateOne(id: number, { amenities, ...updateDto }: UpdatePropertyDto): Promise<Settings> {
    const event = await this.settingsRepository.findOneBy({ id });

    if (!event) {
      throw new NotFoundException(`${Settings.name} with ID ${id} not found`);
    }

    this.settingsRepository.merge(event, updateDto);
    return this.settingsRepository.save(event);
  }

  async remove(id: number): Promise<void> {
    await this.settingsRepository.delete(id);
  }
}
