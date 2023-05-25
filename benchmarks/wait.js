'use strict'

const os = require('os')
const path = require('path')
// const waitOn = require('wait-on')

const socketPath = path.join(os.tmpdir(), 'undici.sock')

let resources
if (process.env.PORT) {
  // resources = [`http-get://localhost:${process.env.PORT}/`]
  resources = [`http://localhost:${process.env.PORT}/`]
} else {
  // resources = [`http-get://unix:${socketPath}:/`]
  resources = [`http://unix:${socketPath}:/`]
}

// @TODO: fix this to work with http/2
// waitOn({
//   resources,
//   timeout: 5000
// }).catch((err) => {
//   console.error(err)
//   process.exit(1)
// })

// just wait for 5 seconds for now
setTimeout(() => {
  process.exit(0)
}, 10000);

