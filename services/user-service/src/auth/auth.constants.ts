import { IJwtConfig } from "./auth.type";

export const jwtConstants = {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
};

export const accessTokenConfig = (): IJwtConfig => ({
    secret: process.env.JWT_SECRET,
    expiresIn: '100m',
});

export const refreshTokenConfig = (): IJwtConfig => ({
    secret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: '60d',
});