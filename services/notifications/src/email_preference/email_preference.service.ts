import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailPreference } from '../../../../shared/common/entities/email_preference.entity';
import { UnSubscribeDto, UpdateEmailPreferenceDto } from './email_preference.dto';
import { randomUUID } from 'crypto'
// import { ConfigService } from '@nestjs/config';
// import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';

@Injectable()
export class EmailPreferenceService {
  constructor(
    @InjectRepository(EmailPreference)
    private readonly emailPreferenceRepository: Repository<EmailPreference>,
    // private readonly configService: ConfigService,
  ) { }

  buildUnsubscribeLink(token: string) {
    // const domain = this.configService.get<string>('domain')
    // const basePath = this.configService.get<string>('basePath')
    const domain = process.env.DOMAIN
    const basePath = process.env.BASE_PATH
    return `${domain}/${basePath}/email-preference/unsubscribe?token=${token}`;
  }

  async subscribe(email: string): Promise<EmailPreference> {
    const existingRecord = await this.emailPreferenceRepository.findOneBy({ email });

    if (existingRecord && existingRecord.unsubscribeToken) {
      return existingRecord;
    }

    const unsubscribeToken = randomUUID();
    await this.emailPreferenceRepository.upsert(
      { email, unsubscribeToken, unSubscribed: false },
      { conflictPaths: ['email'], skipUpdateIfNoValuesChanged: true }
    );

    return this.emailPreferenceRepository.findOneBy({ email });
  }

  async unsubscribe(dto: UnSubscribeDto): Promise<EmailPreference> {
    const preference = await this.emailPreferenceRepository.findOneBy({ unsubscribeToken: dto.token });

    if (!preference) {
      throw new NotFoundException(`${EmailPreference.name} not found`);
    }

    return await this.emailPreferenceRepository.save({
      ...preference,
      unSubscribed: true,
      unsubscribeToken: null
    });
  }

  findOne(id: number): Promise<EmailPreference> {
    return this.emailPreferenceRepository.findOne({
      where: { id },
    });
  }

  findOneByEmail(email: string): Promise<EmailPreference> {
    return this.emailPreferenceRepository.findOne({
      where: { email },
    });
  }

  findOneByToken(unsubscribeToken: string): Promise<EmailPreference> {
    return this.emailPreferenceRepository.findOne({
      where: { unsubscribeToken },
    });
  }

  // findAllPaginated(query: PaginateQuery): Promise<Paginated<EmailPreference>> {
  //   return paginate(query, this.emailPreferenceRepository, {
  //     sortableColumns: ['id', 'createdAt', 'updatedAt'],
  //     //nullSort: 'last',
  //     defaultSortBy: [['id', 'DESC']],
  //     searchableColumns: ['email', 'unsubscribeToken'],
  //     //select: ['id'],
  //     filterableColumns: {
  //       email: true,
  //       //name: [FilterOperator.EQ, FilterSuffix.NOT],
  //       //age: true,
  //     },
  //   });
  // }

  async updateOne(id: number, updateDto: UpdateEmailPreferenceDto): Promise<EmailPreference> {
    const emailPreference = await this.emailPreferenceRepository.findOneBy({ id });

    if (!emailPreference) {
      throw new NotFoundException(`${EmailPreference.name} with ID ${id} not found`);
    }

    this.emailPreferenceRepository.merge(emailPreference, updateDto);
    return this.emailPreferenceRepository.save(emailPreference);
  }

  async remove(id: number): Promise<void> {
    await this.emailPreferenceRepository.delete(id);
  }
}
