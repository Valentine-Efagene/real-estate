/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
            },
        ],
    },
    testMatch: ['**/tests/**/*.test.ts'],
    testTimeout: 60000, // 60 seconds - Lambda invocations can be slow on LocalStack
    verbose: true,
    forceExit: true,
    detectOpenHandles: false,
};
