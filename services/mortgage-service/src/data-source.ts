import * as dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
}

import { DataSource, DataSourceOptions } from "typeorm";
import {
    User,
    Tenant,
    Wallet,
    PaymentPlan,
    PaymentSchedule,
    PaymentInstallment,
    Payment,
    Contract,
    ContractDocument,
    MortgageTransition,
    MortgageTransitionEvent,
    MortgageDownpaymentPlan,
    MortgageDownpaymentInstallment,
    MortgageDownpaymentPayment,
    Transaction,
    Mortgage,
    MortgageDocument,
    MortgageStep,
    MortgageType,
} from '@valentine-efagene/qshelter-common';

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
        Tenant,
        Wallet,
        Transaction,
        Mortgage,
        MortgageDocument,
        MortgageStep,
        MortgageType,
        MortgageDownpaymentPlan,
        MortgageDownpaymentInstallment,
        MortgageDownpaymentPayment,
        MortgageTransition,
        MortgageTransitionEvent,
        // New flexible payment system entities
        PaymentPlan,
        PaymentSchedule,
        PaymentInstallment,
        Payment,
        Contract,
        ContractDocument,
    ],
    dropSchema: process.env.node_env?.includes("test") && IS_NOT_PRODUCTION_DB,
    synchronize: IS_NOT_PRODUCTION_DB,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
}

export default new DataSource(options)