const path                = require('path');
const HtmlWebpackPlugin   = require('html-webpack-plugin');
const CompressionPlugin   = require('compression-webpack-plugin');
const CopyWebpackPlugin   = require('copy-webpack-plugin');
const MiniCssExtractPlugin   = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  entry: './src/main.js',
  output: {
    path:           path.resolve(__dirname, 'RD-wash'),
    clean:          true,
    publicPath:     './',
    filename:       'js/[name].js',
    chunkFilename:  'js/[name].js',
    assetModuleFilename: 'assets/[name][ext]',
  },
  devtool: 'source-map',
  devServer: {
    static:           './RD-wash',
    open:             true,
    port:             3000,
    hot:              true,
    historyApiFallback: true,
  },
  module: {
    rules: [
      {
        test:    /\.m?js$/,
        resolve: { fullySpecified: false },
      },
      {
        test:    /\.js$/,
        exclude: /node_modules/,
        use:     'babel-loader',
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ],
      },
      {
        test: /\.html$/,
        use: 'html-loader'
      },
      {
        test: /\.(png|jpe?g|svg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test:   /[\\/]node_modules[\\/]/,
          name:   'vendors',
          priority: -10,
        },
        default: {
          minChunks:      2,
          reuseExistingChunk: true,
          priority:        -20,
        },
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename:  'index.html',
      inject:    'body',
      minify:    false,
    }),
    new CompressionPlugin({
      test: /\.js(\?.*)?$/i,
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/pages',      to: 'pages'      },
        { from: 'src/assets/css', to: 'assets/css' },
      ],
    }),
    new MiniCssExtractPlugin({
      filename:      'css/[name].css',      // ไม่ใส่ hash
      chunkFilename: 'css/[name].css',
    }),
  ],
  resolve: {
    extensions: ['.mjs','.js'],
    alias: {
      '@controllers': path.resolve(__dirname, 'src/assets/js/Controllers'),
      '@models':      path.resolve(__dirname, 'src/assets/js/Models'),
      '@config':      path.resolve(__dirname, 'src/assets/js/firebase'),
      '@utils':       path.resolve(__dirname, 'src/assets/js/Utils'),
      '@views':       path.resolve(__dirname, 'src/assets/js/Views'),
      '@css':         path.resolve(__dirname, 'src/assets/css'),
    },
  },
};
