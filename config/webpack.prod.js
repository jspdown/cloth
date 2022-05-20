const path = require("path")

const HtmlWebpackPlugin = require("html-webpack-plugin")
const {CleanWebpackPlugin} = require("clean-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")

const ROOT_DIRECTORY = process.cwd()

module.exports = {
    mode: "production",
    entry: {
        main: path.resolve(ROOT_DIRECTORY, "src/index.ts"),
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(ROOT_DIRECTORY, "dist"),
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
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
                    MiniCssExtractPlugin.loader,
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
        new MiniCssExtractPlugin(),
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            template: path.resolve(ROOT_DIRECTORY, "src/index.html"),
            filename: "index.html",
            minify: {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true,
            },
            meta: {
                webgpu: {
                    "http-equiv": "origin-trial",
                    "content": "AqdkdXorUNhIUefLbz/oR7k/dOVaxco3UElcEbYnljN8F7vQrunt2jRnzq39M1XGios73q+209/CZF0xCUGCpQ0AAABHeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjgwIiwiZmVhdHVyZSI6IldlYkdQVSIsImV4cGlyeSI6MTY2MzcxODM5OX0=",
                }
            }
        }),
    ],
}
