const WorkerPlugin = require('worker-plugin')

module.exports = {
  // lintOnSave: false, // uncomment to disable eslint (a workaround for our issue)
  configureWebpack: {
    plugins: [
      new WorkerPlugin({
        globalObject: 'self',
      }),
    ],
  },
}
