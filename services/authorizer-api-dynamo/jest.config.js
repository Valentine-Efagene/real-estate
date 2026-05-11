export default {
    roots: ['<rootDir>/src'],
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts$': ['ts-jest', { useESM: true }],
    },
    extensionsToTreatAsEsm: ['.ts'],
    testMatch: ['**/tests/**/*.test.ts'],
    testPathIgnorePatterns: ['/guide/', '/node_modules/'],
    moduleFileExtensions: ['ts', 'js', 'json'],
};