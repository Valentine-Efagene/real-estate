import * as dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
}

import { DataSource, DataSourceOptions } from "typeorm";
import { User } from "./user/user.entity";
import { Developer } from "./developer/developer.entity";
import { ProposedDevelopment } from "./proposed-development/proposed-development.entity";
import { DeveloperDirector } from "./developer-director/developer-director.entity";
import { DeveloperPoc } from "./developer-poc/developer-poc.entity";
import { Property } from "./property/property.entity";
import { DeveloperDocument } from "./developer-document/developer-document.entity";
import { DeveloperDirectorDocument } from "./developer-director-document/developer-director-document.entity";
import { ProposedDevelopmentDocument } from "./proposed-development-document/proposed-development-document.entity";
import { ProposedProperty } from "./proposed-property/proposed-property.entity";
import { GroupEntity } from "./group-entity/group-entity.entity";
import { CustomNamingStrategy } from "./common/helpers/CustomNamingStrategy";
import { Wallet } from "./wallet/wallet.entity";

const IS_NOT_PRODUCTION_DB = process.env.db_host == '127.0.0.1'

// Force serverless mode for Lambda deployment
const IS_SERVERLESS = true;

export const options: DataSourceOptions = {
    type: 'mysql',
    host: process.env.db_host ?? '127.0.0.1',
    port: Number(process.env.db_port) ?? 3306,
    username: process.env.db_username ?? 'root',
    password: process.env.db_password ?? '',
    database: process.env.db_name ?? 'qshelter-dev',
    entities: [
        User,
        Developer,
        ProposedDevelopment,
        DeveloperDirector,
        DeveloperPoc,
        Property,
        DeveloperDocument,
        DeveloperDirectorDocument,
        ProposedDevelopmentDocument,
        ProposedProperty,
        GroupEntity,
        Wallet
    ],
    dropSchema: process.env.node_env?.includes("test") && IS_NOT_PRODUCTION_DB,
    synchronize: IS_NOT_PRODUCTION_DB,
    namingStrategy: new CustomNamingStrategy(),
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],

    // Serverless-optimized connection pool settings (always enabled for Lambda)
    // extra: {
    //     connectionLimit: 5,           // Limit concurrent connections for serverless
    //     acquireTimeout: 60000,        // 60 seconds to acquire connection
    //     timeout: 60000,               // 60 seconds query timeout
    //     reconnect: true,              // Auto-reconnect on connection loss
    //     keepConnectionAlive: true,    // Keep connections alive between invocations
    //     removeNodeErrorCount: 5,      // Remove node after 5 errors
    //     restoreNodeTimeout: 10000,    // Try to restore node after 10 seconds
    // },
}

export default new DataSource(options)