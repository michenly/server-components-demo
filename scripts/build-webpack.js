/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';

const path = require('path');
const rimraf = require('rimraf');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactServerWebpackPlugin = require('../plugins/react-server-dom-webpack-plugin.js')
  .default;
const ReactClientComponentsLoaderInServer = require('../plugins/react-client-components-loader-in-server.js')
  .default;
const ReactExcludeServerLoader = require('../plugins/next-react-flight-exclude-server-loader.js')
  .default;

const isProduction = process.env.NODE_ENV === 'production';
rimraf.sync(path.resolve(__dirname, '../build'));
webpack(
  {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
    entry: [path.resolve(__dirname, '../server/api.server.js')],
    output: {
      path: path.resolve(__dirname, '../build/server'),
      filename: 'main.js',
    },
    target: 'node',
    module: {
      rules: [
        {
          test: /\.js$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
        // {
        //   test: /\.client\.js?$/,
        //   use: [
        //     {
        //       loader: require.resolve(
        //         './../plugins/react-client-components-loader-in-server.js'
        //       ),
        //     },
        //   ],
        // },
        // {
        //   test: /\.server\.js?$/,
        //   use: {
        //     loader: require.resolve(
        //       './../plugins/next-react-flight-exclude-server-loader.js'
        //     ),
        //   },
        // },
      ],
    },
    plugins: [
      // Needed to resolved https://stackoverflow.com/questions/41522744/webpack-import-error-with-node-postgres-pg-client
      new webpack.IgnorePlugin({resourceRegExp: /^pg-native$/}),
    ],
  },
  (err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      process.exit(1);
      return;
    }
    const info = stats.toJson();
    if (stats.hasErrors()) {
      console.log('[server build] Finished running webpack with errors.');
      info.errors.forEach((e) => console.error(e));
      process.exit(1);
    } else {
      console.log('[server build] Finished running webpack.');
    }
  }
);

webpack(
  {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
    entry: [path.resolve(__dirname, '../src/index.client.js')],
    output: {
      path: path.resolve(__dirname, '../build/client'),
      filename: 'main.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: true,
        template: path.resolve(__dirname, '../public/index.html'),
      }),
      new ReactServerWebpackPlugin({isServer: false}),
    ],
  },
  (err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      process.exit(1);
      return;
    }
    const info = stats.toJson();
    if (stats.hasErrors()) {
      console.log('[client build] Finished running webpack with errors.');
      info.errors.forEach((e) => console.error(e));
      process.exit(1);
    } else {
      console.log('[client build] Finished running webpack.');
    }
  }
);
