const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")

const ROOT_DIRECTORY = process.cwd()

module.exports = {
    mode: "development",
    entry: {
        main: path.resolve(ROOT_DIRECTORY, "src/index.ts"),
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(ROOT_DIRECTORY, "dist"),
    },
    devServer: {
        static: {
            directory: path.resolve(ROOT_DIRECTORY, "dist"),
        },
        compress: true,
        port: 3000,
        client: { overlay: true },
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: [
                    "style-loader",
                    {
                        loader: "css-loader",
                        options: {
                            url: true,
                            import: true,
                            modules: false,
                        },
                    },
                ],
            },
            {
                test: /\.wgsl$/,
                type: "asset/source",
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(ROOT_DIRECTORY, "src/index.html"),
            filename: "index.html",
            meta: {
                webgpu: {
                    "http-equiv": "origin-trial",
                    "content": "AqdkdXorUNhIUefLbz/oR7k/dOVaxco3UElcEbYnljN8F7vQrunt2jRnzq39M1XGios73q+209/CZF0xCUGCpQ0AAABHeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjgwIiwiZmVhdHVyZSI6IldlYkdQVSIsImV4cGlyeSI6MTY2MzcxODM5OX0=",
                }
            }
        }),
    ],
}
