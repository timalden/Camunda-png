const path = require('path');
module.exports = {
  mode: 'production',
  context: __dirname,
  entry: './client/index.js',
  output: { path: path.resolve(__dirname, 'dist'), filename: 'client.js' },
  resolve: { modules: [path.resolve(__dirname, '../node_modules')] },
  resolveLoader: { modules: [path.resolve(__dirname, '../node_modules')] },
  devtool: false,
  optimization: { minimize: false }
};
