import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@valentine-efagene/qshelter-common';
import { Repository } from 'typeorm';
import { UserService } from './user.service';

@Injectable()
export class UserSeeder {
    private readonly logger = new Logger(UserSeeder.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly userService: UserService,
    ) { }

    async seed() {
        const adminsEmailsToSeed = ['admin@admin.com'];

        for (const email of adminsEmailsToSeed) {
            const existingAdmin = await this.userRepository
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.roles', 'role')
                .where('user.email = :email', { email })
                .andWhere('role.name = :roleName', { roleName: 'admin' })
                .getOne();

            if (!existingAdmin) {
                const newAdmin = await this.userService.createAdmin({
                    email,
                    password: 'Pa$Sw0rd',
                    country: 'Canada',
                })
            }
        }
    }
}
