const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: './src/serverless.ts',
    target: 'node',
    mode: 'development',
    externals: [
        nodeExternals({
            allowlist: [
                // Bundle nothing from node_modules - keep everything external
                // This prevents webpack from breaking class inheritance
            ],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'serverless.js',
        path: path.resolve(__dirname, 'dist-webpack'),
        libraryTarget: 'commonjs2',
    },
    optimization: {
        minimize: false,
    },
};