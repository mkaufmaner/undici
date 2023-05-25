'use strict'

const { once } = require('node:events')
const fastify = require('fastify')

const { test } = require('tap')
const pem = require('https-pem')

const { Client } = require('..')

test('Should support secure HTTPS connection', async (t) => {
  t.plan(5)

  const body = []
  const server = fastify({
    http2: false,
    https: {
      allowHTTP1: false,
      key: pem.key,
      cert: pem.cert
    }
  }, (err) => {
    t.error(err)
    t.teardown(() => {
      server.close()
    })
  })

  // this route can only be accessed over https
  server.get('/', (req, res) => {
    t.type(req.raw, 'IncomingMessage')
    t.type(res.raw, 'ServerResponse')

    res.code(200).send({ hello: 'world' })
  })

  await server.listen({
    port: 0
  })

  const port = server.addresses()[0].port

  const client = new Client(`https://localhost:${port}`, {
    connect: {
      rejectUnauthorized: false
    }
  })

  // attach the client and server to teardown in this specific order otherwise the teardown will hang
  // maybe this behavior is a bug?
  t.teardown(client.close.bind(client))
  t.teardown(() => {
    server.close()
  })

  const response = await client.request({
    path: '/',
    method: 'GET'
  })

  response.body.on('data', chunk => {
    body.push(chunk)
  })

  await once(response.body, 'end')

  t.equal(response.statusCode, 200)
  t.equal(response.headers['content-type'], 'application/json; charset=utf-8')
  t.equal(Buffer.concat(body).toString('utf8'), '{"hello":"world"}')
})

test('Should support secure H2 connection using ALPN', async (t) => {
  t.plan(5)

  const body = []
  const server = fastify({
    http2: true,
    https: {
      allowHTTP1: false, // fallback support for HTTP1
      key: pem.key,
      cert: pem.cert
    }
  }, (err) => {
    t.error(err)
    t.teardown(() => {
      server.close()
    })
  })

  // this route can be accessed through both protocols
  server.get('/', (req, res) => {
    t.type(req.raw, 'Http2ServerRequest')
    t.type(res.raw, 'Http2ServerResponse')

    res.code(200).send({ hello: 'world' })
  })

  await server.listen({
    port: 0
  })

  const port = server.addresses()[0].port

  const client = new Client(`https://localhost:${port}`, {
    connect: {
      rejectUnauthorized: false
    }
  })

  // attach the client and server to teardown in this specific order otherwise the teardown will hang
  // maybe this behavior is a bug?
  t.teardown(client.close.bind(client))
  t.teardown(() => {
    server.close()
  })

  const response = await client.request({
    path: '/',
    method: 'GET'
  })

  response.body.on('data', chunk => {
    body.push(chunk)
  })

  await once(response.body, 'end')

  t.equal(response.statusCode, 200)
  t.equal(response.headers['content-type'], 'application/json; charset=utf-8')
  t.equal(Buffer.concat(body).toString('utf8'), '{"hello":"world"}')
})
