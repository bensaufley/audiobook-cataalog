/* eslint-disable import/no-extraneous-dependencies */
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { resolve } from 'path';
import { Configuration, DefinePlugin, RuleSetRule } from 'webpack';
import webpackNodeExternals from 'webpack-node-externals';

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'];

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';

// urql importing 'preact/hooks' (and maybe more) has
// issues in Webpack 5 without this
// https://github.com/webpack/webpack/issues/11467#issuecomment-691873586
const moduleHackRule: RuleSetRule = {
  test: /\.m?js/,
  type: 'javascript/auto',
  resolve: { fullySpecified: false },
};

const babelLoaderRule: RuleSetRule = {
  test: /\.[tj]sx?$/,
  loader: 'babel-loader',
  exclude: /node_modules/,
  resolve: {
    extensions,
  },
};

const alias = {
  '~client': resolve(process.env.ROOT_DIR, 'src/client/'),
  '~server': resolve(process.env.ROOT_DIR, 'src/server/'),
  '~spec': resolve(process.env.ROOT_DIR, 'spec/'),
};

const optimization: Configuration['optimization'] = {
  minimize: mode === 'production',
};

export const serverConfig: Configuration = {
  entry: () => ['./src/server/index.ts'], // https://github.com/webpack-contrib/webpack-hot-client/issues/11
  output: {
    filename: 'index.js',
    path: resolve(process.env.ROOT_DIR, '.build/server'),
  },

  externals: [webpackNodeExternals()],
  mode,
  module: {
    rules: [moduleHackRule, babelLoaderRule],
  },
  optimization,
  plugins: [
    new DefinePlugin({
      'process.env.ROOT_DIR': JSON.stringify(process.env.ROOT_DIR),
    }),
  ],
  resolve: { alias },
  target: 'node',
};

export const clientConfig: Configuration = {
  entry: () => ['./src/client/index.tsx'], // https://github.com/webpack-contrib/webpack-hot-client/issues/11
  output: {
    filename: 'bundle-[hash].js',
    path: resolve(process.env.ROOT_DIR, '.build/client'),
    publicPath: '/static/',
  },

  mode,
  module: {
    rules: [moduleHackRule, babelLoaderRule],
  },
  optimization,
  plugins: [
    new HtmlWebpackPlugin({
      minify: false,
      template: resolve(process.env.ROOT_DIR, 'src/client/index.html'),
    }),
    new DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
  ],
  resolve: { alias },
  target: 'web',
};

export default [serverConfig, clientConfig];
