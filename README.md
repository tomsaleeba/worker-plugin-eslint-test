# worker-plugin-eslint-test

A reproduction (not quite minimal because we used vue-cli) of
https://github.com/webpack-contrib/eslint-loader/issues/261 showing how eslint
seems to fail validation on our worker script (loaded by `worker-plugin`) but
not on the first run.

Summary of problems:
  - dev server builds fine on first run, then gets eslint error on rebuilds.
  - errors in eslint don't line up with the source file: line numbers are wrong
      and it mentions errors that don't seem to be present. Presumably
      transpiled/processed code is being linted

My test environment:
```
Node: v10.18.0
Yarn: 1.22.0
uname -a: Linux tom-x1eg2 5.4.18-1-MANJARO #1 SMP PREEMPT Thu Feb 6 11:41:30 UTC 2020 x86_64 GNU/Linux
```

It's worth noting that this project isn't running the out-of-the-box linting
settings. There is a custom `.prettierrc` and `airbnb-base` is added to the
`.eslintrc.js`.

How to reproduce:
 1. clone repo
 1. install deps: `yarn`
 1. run dev server: `yarn serve`. This seems to always succeed on the first run
    ```
    DONE  Compiled successfully in 912ms


     App running at:
     - Local:   http://localhost:8080/
     - Network: unavailable

     Note that the development build is not optimized.
     To create a production build, run yarn build.
    ```
 1. you can load the app at http://localhost:8080 and see the worker working
    when you click the button
 1. now touch one of the source files: `touch src/worker.js`
 1. the dev server will rebuild and now the build fails:
    ```
     ERROR  Failed to compile with 1 errors

     error  in ./src/worker.js

    Module build failed (from ./node_modules/worker-plugin/dist/loader.js):
    ModuleError: Module Error (from ./node_modules/eslint-loader/index.js):

    /zeta/git/worker-plugin-eslint-test/src/worker.js
      2:1   error    Expected 1 empty line after import statement not followed by another import  import/newline-after-import
      2:36  warning  Delete `;`                                                                   prettier/prettier
      3:1   error    Unexpected use of 'self'                                                     no-restricted-globals
      3:34  warning  Unexpected unnamed function                                                  func-names
      3:42  warning  Delete `·`                                                                   prettier/prettier
      4:36  warning  Delete `;`                                                                   prettier/prettier
      5:3   warning  Replace `;` with `⏎`                                                         prettier/prettier

    ✖ 7 problems (2 errors, 5 warnings)
      1 error and 4 warnings potentially fixable with the `--fix` option.

        at emitError (/zeta/git/worker-plugin-eslint-test/node_modules/webpack/lib/NormalModule.js:173:6)
        at printLinterOutput (/zeta/git/worker-plugin-eslint-test/node_modules/eslint-loader/index.js:134:9)
        at /zeta/git/worker-plugin-eslint-test/node_modules/eslint-loader/index.js:261:11
        at /zeta/git/worker-plugin-eslint-test/node_modules/loader-fs-cache/index.js:122:24
        at Gunzip.cb (/zeta/git/worker-plugin-eslint-test/node_modules/loader-fs-cache/index.js:47:14)
        at Gunzip.zlibBufferOnEnd (zlib.js:133:10)
        at Gunzip.emit (events.js:203:15)
        at endReadableNT (_stream_readable.js:1143:12)
        at process._tickCallback (internal/process/next_tick.js:63:19)

     @ ./node_modules/cache-loader/dist/cjs.js??ref--12-0!./node_modules/babel-loader/lib!./node_modules/cache-loader/dist/cjs.js??ref--0-0!./node_modules/vue-loader/lib??vue-loader-options!./src/App.vue?vue&type=script&lang=js& 1:0-117
     @ ./src/App.vue?vue&type=script&lang=js&
     @ ./src/App.vue
     @ ./src/main.js
     @ multi (webpack)-dev-server/client?http://localhost:8080/sockjs-node (webpack)/hot/dev-server.js ./src/main.js
    ```

Some of these errors are legitimate like the use of self and unnamed function.
Let's ignore those. The others refer to things that you can't see in the source
file. The line numbers don't line up and, for example, there aren't any
semicolons in the source.

I'm assuming something in the chain is pre-processing our source and then that
output is being linted, which probably isn't what we want to happen.

The inconsistent failure (success initially and failure on hot-reloads) isn't
ideal either.

It's worth noting that `yarn build` always seems to fail.

# Workaround: disable eslint completely
We can disable eslint with:
```diff
diff --git a/vue.config.js b/vue.config.js
index 071e432..a4ff094 100644
--- a/vue.config.js
+++ b/vue.config.js
@@ -1,6 +1,7 @@
 const WorkerPlugin = require('worker-plugin')
 
 module.exports = {
+  lintOnSave: false,
   chainWebpack: config => {
     config.plugin('worker').use(WorkerPlugin)
   },
```

It stops the eslint errors from showing up (because eslint is not running). You
can make changes to the worker script and it will be rebuilt. Just refresh the
page to reload the worker script, it doesn't seem to be hot-reloaded (not ideal
but also not relevant to this issue).

# Workaround: disable eslint for only our worker file
By adding a comment at the top of our worker script, we can disable eslint for
it:
```javascript
/* eslint-disable */
```

Obviously this isn't ideal because we want a well linted file but it will let
you continue with development so you can come back to this later.

# Diving deeper
If you apply this change to `node_modules/eslint-loader/index.js`:
```diff
--- index.js.bak	2020-02-17 18:07:11.092061688 +1030
+++ index.js	2020-02-17 18:07:56.208537585 +1030
@@ -239,6 +239,10 @@
     resourcePath = resourcePath.substr(cwd.length + 1);
   }
 
+  if (resourcePath === 'src/worker.js') {
+    console.log(input)
+  }
+
   // return early if cached
   if (config.cache) {
     var callback = webpack.async();
```
...then you'll be able to see what's getting linted. Here's a commented copy of
the output:

```
# first time through
// This is a module worker, so we can use imports (in the browser too!)
import { makeEven } from './common'

self.addEventListener('message', event => {
  postMessage(makeEven(event.data))
})

# second time through
// This is a module worker, so we can use imports (in the browser too!)
import { makeEven } from './common';
self.addEventListener('message', function (event) {
  postMessage(makeEven(event.data));
});
```

We can see our worker goes through the linter twice and on the second time we
are linting something that's already been processed. If we can stop that linting
of processed code, we'll be set.

I think the linter may be touching our worker script too. Occasionally my editor
(vim) tells me that the worker script has been modified since last reading it
and the only other thing running is the webpack dev server. It's hard to
reproduce so I can't confirm if this is the case.
