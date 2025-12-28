const path = require('path');
const nodeExternals = require('webpack-node-externals');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: 'production',
    target: 'node',
    entry: './src/serverless.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'serverless.js',
        libraryTarget: 'commonjs2',
    },
    // Only externalize packages that absolutely need to be external (native modules, NestJS framework, etc.)
    externals: [nodeExternals({
        allowlist: [
            // Bundle everything by default, except these critical runtime dependencies
        ],
    })],
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,  // Handle .ts files using ts-loader
                loader: 'ts-loader',
                exclude: /node_modules/,  // Exclude node_modules from transpilation
            },
        ],
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: true,
                    },
                    mangle: true,
                },
            }),
        ],
    },
};