const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = [
  // Main extension bundles
  {
    name: 'extension',
    entry: {
      content: './src/content/index.ts',
      background: './src/background/index.ts',
      popup: './src/popup/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: false,
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@background': path.resolve(__dirname, 'src/background'),
        '@worker': path.resolve(__dirname, 'src/worker'),
        '@popup': path.resolve(__dirname, 'src/popup'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public', to: '.' },
        ],
      }),
    ],
    optimization: {
      splitChunks: false,
    },
    devtool: 'cheap-module-source-map',
  },

  // Web Worker bundle — separate config so it gets its own self-contained output
  {
    name: 'worker',
    entry: './src/worker/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'worker.js',
    },
    target: 'webworker',
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    optimization: {
      splitChunks: false,
    },
    devtool: 'cheap-module-source-map',
  },
];
