'use strict'

const { once } = require('node:events')
const fastify = require('fastify')
const https = require('https')
const { test } = require('tap')
const pem = require('https-pem')

const { Client } = require('..')

// test('Should support secure HTTPS connection', async (t) => {
//   t.plan(5)

//   const body = []
//   const server = fastify({
//     http2: false,
//     https: {
//       allowHTTP1: false,
//       key: pem.key,
//       cert: pem.cert
//     }
//   }, (err) => {
//     t.error(err)
//     t.teardown(() => {
//       server.close()
//     })
//   })

//   // this route can only be accessed over https
//   server.get('/', (req, res) => {
//     t.type(req.raw, 'IncomingMessage')
//     t.type(res.raw, 'ServerResponse')

//     res.code(200).send({ hello: 'world' })
//   })

//   await server.listen({
//     port: 0
//   })

//   const port = server.addresses()[0].port

//   const client = new Client(`https://localhost:${port}`, {
//     connect: {
//       rejectUnauthorized: false
//     }
//   })

//   // attach the client and server to teardown in this specific order otherwise the teardown will hang
//   // maybe this behavior is a bug?
//   t.teardown(client.close.bind(client))
//   t.teardown(() => {
//     server.close()
//   })

//   const response = await client.request({
//     path: '/',
//     method: 'GET'
//   })

//   response.body.on('data', chunk => {
//     body.push(chunk)
//   })

//   await once(response.body, 'end')

//   t.equal(response.statusCode, 200)
//   t.equal(response.headers['content-type'], 'application/json; charset=utf-8')
//   t.equal(Buffer.concat(body).toString('utf8'), '{"hello":"world"}')
// })

test('Should support secure H2 connection using ALPN', async (t) => {
  t.plan(5)

  const httpsBody = []
  const undiciBody = []

  const server = fastify({
    http2: true,
    https: {
      allowHTTP1: true, // fallback support for HTTP1
      key: pem.key,
      cert: pem.cert
    }
  }, (err) => {
    t.error(err)
    t.teardown(() => {
      server.close()
    })
  })

  server.get('/http1', (req, res) => {
    t.type(req.raw, 'IncomingMessage')
    t.type(res.raw, 'ServerResponse')

    // res.code(200).send({ hello: 'world' })
    res.code(200).headers({
      'x-custom-request-header': req.headers['x-custom-request-header'] || '',
      'x-custom-response-header': 'using http1'
    }).send('hello http1')
  })

  // server.get('/http2', (req, res) => {
  //   t.type(req.raw, 'Http2ServerRequest')
  //   t.type(res.raw, 'Http2ServerResponse')

  //   // res.code(200).send({ hello: 'world' })
  //   res.code(200).headers({
  //     'x-custom-request-header': req.headers['x-custom-request-header'] || '',
  //     'x-custom-response-header': 'using http2'
  //   }).send('hello http2')
  // })

  await server.listen({
    port: 0
  })

  const address = server.addresses()[0].address
  const port = server.addresses()[0].port

  // http/1
  const httpsOptions = {
    ...new URL(`https://${address}:${port}/http1`),
    method: 'GET',
    headers: {
      'x-custom-request-header': 'want http1'
    },
    rejectUnauthorized: false,
    agent: new https.Agent({
      keepAlive: true,
      rejectUnauthorized: false
    })
  }

  // const httpsGet = https.request(`https://localhost:${port}/`, options, async (res) => {
  const httpsGet = https.request(httpsOptions, (res) => {
    res.on('data', (chunk) => {
      httpsBody.push(chunk)
    })

    res.on('end', () => {
      console.log(Buffer.concat(httpsBody).toString('utf8'));
    });

    res.on('finish', () => {
      t.equal(res.statusCode, 200)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      t.equal(res.headers['x-custom-request-header'], 'want http1')
      t.equal(res.headers['x-custom-response-header'], 'using http1')
      t.equal(Buffer.concat(httpsBody).toString('utf8'), 'hello http1')
    })

    // await once(res, 'finish')

    // t.equal(res.statusCode, 200)
    // t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    // t.equal(res.headers['x-custom-request-header'], 'want http/1')
    // t.equal(res.headers['x-custom-response-header'], 'using http/1')
    // t.equal(Buffer.concat(body).toString('utf8'), 'hello http/1')
  }).on('error', (err) => {
    console.error(err);
  });

  // t.teardown(client.close.bind(client))
  t.teardown(() => {
    server.close()
  })

  // const client = new Client(`https://localhost:${port}`, {
  //   connect: {
  //     rejectUnauthorized: false
  //   }
  // })

  // // attach the client and server to teardown in this specific order otherwise the teardown will hang
  // // maybe this behavior is a bug?
  // t.teardown(client.close.bind(client))
  // t.teardown(() => {
  //   server.close()
  // })

  // const response = await client.request({
  //   path: '/',
  //   method: 'GET'
  // })

  // response.body.on('data', chunk => {
  //   body.push(chunk)
  // })

  // await once(response.body, 'end')

  // t.equal(response.statusCode, 200)
  // t.equal(response.headers['content-type'], 'application/json; charset=utf-8')
  // t.equal(Buffer.concat(body).toString('utf8'), '{"hello":"world"}')
})
