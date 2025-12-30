import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailPreference } from '../../../../shared/common/entities/email_preference.entity';
import { EmailPreferenceService } from './email_preference.service';
import { Repository } from 'typeorm';

const userArray = [
  {
    firstName: 'firstName #1',
    lastName: 'lastName #1',
  },
  {
    firstName: 'firstName #2',
    lastName: 'lastName #2',
  },
];

const oneEmailPreference = {
  firstName: 'firstName #1',
  lastName: 'lastName #1',
};

describe('EmailPreferenceService', () => {
  let service: EmailPreferenceService;
  let repository: Repository<EmailPreference>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailPreferenceService,
        {
          provide: getRepositoryToken(EmailPreference),
          useValue: {
            find: jest.fn().mockResolvedValue(userArray),
            findOneBy: jest.fn().mockResolvedValue(oneEmailPreference),
            save: jest.fn().mockResolvedValue(oneEmailPreference),
            remove: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailPreferenceService>(EmailPreferenceService);
    repository = module.get<Repository<EmailPreference>>(getRepositoryToken(EmailPreference));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should successfully insert a user', () => {
      const oneEmailPreference = {
        firstName: 'firstName #1',
        lastName: 'lastName #1',
      };

      expect(
        service.create({
          firstName: 'firstName #1',
          lastName: 'lastName #1',
        }),
      ).resolves.toEqual(oneEmailPreference);
    });
  });

  describe('findAll()', () => {
    it('should return an array of users', async () => {
      const users = await service.findAll();
      expect(users).toEqual(userArray);
    });
  });

  describe('findOne()', () => {
    it('should get a single user', () => {
      const repoSpy = jest.spyOn(repository, 'findOneBy');
      expect(service.findOne(1)).resolves.toEqual(oneEmailPreference);
      expect(repoSpy).toBeCalledWith({ id: 1 });
    });
  });

  describe('remove()', () => {
    it('should call remove with the passed value', async () => {
      const removeSpy = jest.spyOn(repository, 'delete');
      const retVal = await service.remove(2);
      expect(removeSpy).toBeCalledWith(2);
      expect(retVal).toBeUndefined();
    });
  });
});
