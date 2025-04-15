const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const publicPath = isProduction ? '/tectostress/' : '/';

    return {
        entry: './src/index.tsx',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'bundle.js',
            publicPath,
            clean: true, // Nettoie le dossier dist avant chaque build
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js', '.jsx'],
            alias: {
                '@': path.resolve(__dirname, 'src'),
                '@alfredo-taboada/stress': path.resolve(__dirname, 'node_modules/@alfredo-taboada/stress'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.(ts|tsx|js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                '@babel/preset-env',
                                ['@babel/preset-react', { runtime: 'automatic' }],
                                '@babel/preset-typescript'
                            ]
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader', 'postcss-loader'],
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'public/index.html',
                filename: 'index.html',
                inject: true // On ne veut pas que le plugin injecte le script car on l'a déjà fait manuellement
            })
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, 'public'),
            },
            port: 3000,
            hot: true,
            historyApiFallback: true,
        },
    };
};