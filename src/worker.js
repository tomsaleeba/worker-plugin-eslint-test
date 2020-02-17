// This is a module worker, so we can use imports (in the browser too!)
import { makeEven } from './common'

self.addEventListener('message', event => {
  postMessage(makeEven(event.data))
})
