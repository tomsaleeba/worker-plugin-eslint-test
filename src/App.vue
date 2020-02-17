<template>
  <div id="app">
    <div>Worker result = {{ workerResult }}</div>
    <button @click="onTriggerWorker">Trigger worker</button>
  </div>
</template>

<script>
const piWorker = new Worker('./worker.js', { type: 'module' })

export default {
  name: 'App',
  data() {
    return {
      workerResult: null,
    }
  },
  mounted() {
    piWorker.onmessage = event => {
      this.workerResult = event.data
    }
  },
  methods: {
    onTriggerWorker() {
      piWorker.postMessage(42)
    },
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
