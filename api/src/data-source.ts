import 'reflect-metadata';
import * as dotenv from 'dotenv';

import { User } from './user/user.entity';
import { Role } from './role/role.entity';
import { Property } from './property/property.entity';
import { RefreshToken } from './refresh_token/refresh_token.entity';
import { Ticket } from './ticket/ticket.entity';
import { UserSuspension } from './user_suspensions/user_suspensions.entity';
import { PasswordResetToken } from './password_reset_tokens/password_reset_tokens.entity';
import { CustomNamingStrategy } from './common/helpers/CustomNamingStrategy';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Permission } from './permission/permission.entity';
import { AccessLog } from './access-log/access-log.entity';
import { PropertyMedia } from './property-media/property-media.entity';
import { Settings } from './settings/settings.entity';
import { EventTicketType } from './event-ticket-type/event-ticket-type.entity';
import { TicketCategory } from './ticket-category/ticket-category.entity';
import { EventAuditLog } from './event-audit-log/event-audit-log.entity';
import { TicketAuditLog } from './ticket-audit-log/ticket-audit-log.entity';
import { BulkInviteTask } from './bulk-invite/bulk-invite-task.entity';

if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
}

const IS_NOT_PRODUCTION_DB = process.env.DB_HOST == '127.0.0.1'

export const options = {
    type: 'mysql',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT) ?? 3306,
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    entities: [
        User,
        Role,
        Permission,
        RefreshToken,
        Property,
        Ticket,
        UserSuspension,
        PropertyMedia,
        PasswordResetToken,
        AccessLog,
        Settings,
        EventTicketType,
        TicketCategory,
        EventAuditLog,
        TicketAuditLog,
        BulkInviteTask,
    ],
    dropSchema: process.env.NODE_ENV?.includes("test") && IS_NOT_PRODUCTION_DB,
    synchronize: IS_NOT_PRODUCTION_DB,
    namingStrategy: new CustomNamingStrategy(),
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
}

export default new DataSource(options as DataSourceOptions)