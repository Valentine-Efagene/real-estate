import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';
import { RoleModule } from '../role/role.module';
import { UserSeeder } from './user.seeder';
import { Role } from '../role/role.entity';
import { TicketModule } from '../ticket/ticket.module';
import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    S3UploaderModule,
    RoleModule,
    TicketModule,
    OrderModule,
    PaymentModule,
  ],
  providers: [UserService, UserSeeder],
  controllers: [UserController],
  exports: [UserService, UserSeeder]
})
export class UserModule { }
