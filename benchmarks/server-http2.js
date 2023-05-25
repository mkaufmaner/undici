'use strict'

const { unlinkSync } = require('fs')
const { createSecureServer } = require('node:http2')
const os = require('os')
const path = require('path')
const cluster = require('cluster')
const fastify = require('fastify')
const pem = require('https-pem')

const socketPath = path.join(os.tmpdir(), 'undici.sock')

const port = process.env.PORT || socketPath
const timeout = parseInt(process.env.TIMEOUT, 10) || 1
const workers = parseInt(process.env.WORKERS) || os.cpus().length

if (cluster.isPrimary) {
  try {
    unlinkSync(socketPath)
  } catch (_) {
    // Do nothing if the socket does not exist
  }

  for (let i = 0; i < workers; i++) {
    cluster.fork()
  }
} else {
  const buf = Buffer.alloc(64 * 1024, '_')
  // const server = createSecureServer({
  //   ...pem
  // }, (req, res) => {
  //   setTimeout(() => {
  //     // console.log('responding')
  //     res.end(buf)
  //   }, timeout)
  // }).listen(port)

  // const server = createSecureServer(pem);

  // server.on('stream', (stream, headers) => {
  //   setTimeout(() => {
  //     // stream.respond({
  //     //   'content-type': 'text/plain; charset=utf-8',
  //     //   ':status': 200
  //     // })

  //     stream.end(buf)
  //   }, timeout)
  // })

  // server.listen(port)

  const server = fastify({
    http2: true,
    https: {
      allowHTTP1: false,
      key: pem.key,
      cert: pem.cert
    },
    keepAliveTimeout: 600e3
  })

  // this route can only be accessed over https
  server.get('/', (req, res) => {
    res.reply(200).send(buf)
  })

  server.listen({ port })
}
