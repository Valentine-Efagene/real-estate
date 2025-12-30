import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './email_preference.controller';
import { NotificationService } from './email_preference.service';
import { CreateNotificationDto } from './email_preference.dto';

const createNotificationDto: CreateNotificationDto = {
  title: 'Example',
  description: 'Notice'
};

describe('NotificationController', () => {
  let usersController: NotificationController;
  let usersService: NotificationService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        {
          provide: NotificationService,
          useValue: {
            create: jest
              .fn()
              .mockImplementation((user: CreateNotificationDto) =>
                Promise.resolve({ id: '1', ...user }),
              ),
            findAll: jest.fn().mockResolvedValue([
              {
                firstName: 'firstName #1',
                lastName: 'lastName #1',
              },
              {
                firstName: 'firstName #2',
                lastName: 'lastName #2',
              },
            ]),
            findOne: jest.fn().mockImplementation((id: string) =>
              Promise.resolve({
                firstName: 'firstName #1',
                lastName: 'lastName #1',
                id,
              }),
            ),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    usersController = app.get<NotificationController>(NotificationController);
    usersService = app.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(usersController).toBeDefined();
  });

  describe('create()', () => {
    it('should create a user', () => {
      usersController.create(createNotificationDto);
      expect(usersController.create(createNotificationDto)).resolves.toEqual({
        id: '1',
        ...createNotificationDto,
      });
      expect(usersService.create).toHaveBeenCalledWith(createNotificationDto);
    });
  });

  describe('findAll()', () => {
    it('should find all users ', () => {
      usersController.findAll({
        limit: 10,
        page: 1,
        search: 'search',
        startDate: '2021-01-01',
        endDate: '2021-01-01',
      });
      expect(usersService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('should find a user', () => {
      expect(usersController.findOne(1)).resolves.toEqual({
        firstName: 'firstName #1',
        lastName: 'lastName #1',
        id: 1,
      });
      expect(usersService.findOne).toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should remove the user', () => {
      usersController.remove(1);
      expect(usersService.remove).toHaveBeenCalled();
    });
  });
});
