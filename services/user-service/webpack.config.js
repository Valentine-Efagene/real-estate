const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: './src/serverless.ts',
    target: 'node',
    mode: 'production',
    externals: [
        nodeExternals({
            allowlist: ['@valentine-efagene/qshelter-common']
        })
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'serverless.js',
        path: path.resolve(__dirname, 'dist-webpack'),
        libraryTarget: 'commonjs2',
    },
    optimization: {
        minimize: false, // NestJS doesn't work well with minification
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^aws-sdk$/, // AWS SDK is available in Lambda runtime
        }),
    ],
};
