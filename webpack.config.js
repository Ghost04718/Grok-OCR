const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.js',
    'popup/popup': './src/popup/popup.js',
    'options/options': './src/options/options.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'src/manifest.json', 
          to: 'manifest.json' 
        },
        { 
          from: 'src/popup/popup.css', 
          to: 'popup/popup.css' 
        },
        { 
          from: 'src/options/options.css', 
          to: 'options/options.css' 
        },
        { 
          from: 'src/welcome.html', 
          to: 'welcome.html' 
        },
        // Extension icons
        { 
          from: 'src/images', 
          to: 'images',
          noErrorOnMissing: true
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup/popup.html',
      chunks: ['popup/popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/options/options.html',
      filename: 'options/options.html',
      chunks: ['options/options'],
    }),
  ],
  optimization: {
    minimize: true,
  },
};