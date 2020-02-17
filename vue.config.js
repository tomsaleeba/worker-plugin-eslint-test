const WorkerPlugin = require('worker-plugin')

module.exports = {
  lintOnSave: false,
  chainWebpack: config => {
    config.plugin('worker').use(WorkerPlugin)
  },
}
