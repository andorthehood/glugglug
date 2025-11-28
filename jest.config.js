export default {
    testEnvironment: 'node',
    testTimeout: 30000, // 30 seconds max per test
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/*.(test|spec).+(ts|tsx|js)'],
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest", {
            jsc: {
                target: 'es2021',
            },
            sourceMaps: true,
        }],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
};