const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ROOT_DIRECTORY = process.cwd();

module.exports = {
    mode: 'development',
    entry: {
        main: path.resolve(ROOT_DIRECTORY, 'src/index.ts'),
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(ROOT_DIRECTORY, 'dist'),
    },
    devServer: {
        static: {
            directory: path.resolve(ROOT_DIRECTORY, 'dist'),
        },
        compress: true,
        port: 3000,
        client: { overlay: true },
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            url: true,
                            import: true,
                            modules: false,
                        },
                    },
                ],
            },
        ],
    },
    "types": ["@webgpu/types"],
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(ROOT_DIRECTORY, 'src/index.html'),
            filename: 'index.html',
        }),
    ],
};
