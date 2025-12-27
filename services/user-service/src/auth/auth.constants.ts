import { IJwtConfig } from "./auth.type";
import { ConfigService } from "@valentine-efagene/qshelter-common";

const configService = ConfigService.getInstance();
const stage = process.env.NODE_ENV || 'dev';

// Cache secrets on module load
let jwtSecret: string;
let refreshSecret: string;

// Initialize secrets asynchronously
export const initializeSecrets = async () => {
    const jwtSecrets = await configService.getJwtSecret(stage);
    const refreshSecrets = await configService.getRefreshTokenSecret(stage);
    jwtSecret = jwtSecrets.secret;
    refreshSecret = refreshSecrets.secret;
};

export const getAccessTokenConfig = (): IJwtConfig => ({
    secret: jwtSecret,
    expiresIn: '100m',
});

export const getRefreshTokenConfig = (): IJwtConfig => ({
    secret: refreshSecret,
    expiresIn: '60d',
});

export const getJwtSecret = () => jwtSecret;
export const getRefreshSecret = () => refreshSecret;