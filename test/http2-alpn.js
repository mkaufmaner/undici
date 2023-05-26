'use strict'

const https = require('node:https')
const { once } = require('node:events')
const { createSecureServer } = require('node:http2')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('tap')

const { Client } = require('..')

// get the crypto fixtures
const key = readFileSync(join(__dirname, 'fixtures', 'key.pem'), 'utf8')
const cert = readFileSync(join(__dirname, 'fixtures', 'cert.pem'), 'utf8')
const ca = readFileSync(join(__dirname, 'fixtures', 'ca.pem'), 'utf8')

test('Should upgrade to HTTP/2 when HTTPS/1 is available', async (t) => {
  t.plan(10)

  const body = []
  const httpsBody = []

  // create the server and server stream handler
  const server = createSecureServer(
    {
      key,
      cert,
      allowHTTP1: true
    },
    (req, res) => {
      if (req.httpVersion === '2.0') {
        // ignore http/2 requests since these will be handled by the stream handler
        return
      }

      // handle http/1 requests
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'x-custom-request-header': req.headers['x-custom-request-header'] || '',
        'x-custom-response-header': 'using http/1'
      })
      res.end('hello http/1')
    }
  )

  server.on('stream', (stream, headers) => {
    stream.respond({
      ':status': 200,
      'content-type': 'text/plain; charset=utf-8',
      'x-custom-request-header': headers['x-custom-request-header'] || '',
      'x-custom-response-header': 'using http/2'
    })
    stream.end('hello http/2')
  })

  server.listen(0)
  await once(server, 'listening')

  // close the server on teardown
  t.teardown(server.close.bind(server))

  // set the port
  const port = server.address().port

  // test undici against http/2
  const client = new Client(`https://localhost:${port}`, {
    connect: {
      ca,
      servername: 'agent1'
    }
  })

  // close the client on teardown
  t.teardown(client.close.bind(client))

  // make an undici request using where it wants http/2
  const response = await client.request({
    path: '/',
    method: 'GET',
    headers: {
      'x-custom-request-header': 'want http/2'
    }
  })

  response.body.on('data', chunk => {
    body.push(chunk)
  })

  await once(response.body, 'end')

  t.equal(response.statusCode, 200)
  t.equal(response.headers['content-type'], 'text/plain; charset=utf-8')
  t.equal(response.headers['x-custom-request-header'], 'want http/2')
  // only http/2 streams will return this header
  t.equal(response.headers['x-custom-response-header'], 'using http/2')
  t.equal(Buffer.concat(body).toString('utf8'), 'hello http/2')

  // make an https request for http/1 to confirm undici is using http/2
  const httpsOptions = {
    headers: {
      'x-custom-request-header': 'want http/1'
    },
    ca,
    servername: 'agent1'
  }

  const httpsResponse = await new Promise((resolve, reject) => {
    const httpsRequest = https.get(`https://localhost:${port}/`, httpsOptions, (res) => {
      res.on('data', (chunk) => {
        httpsBody.push(chunk)
      })

      res.on('end', () => {
        resolve(res)
      })
    }).on('error', (err) => {
      reject(err)
    })

    t.teardown(httpsRequest.destroy.bind(httpsRequest))
  })

  t.equal(httpsResponse.statusCode, 200)
  t.equal(httpsResponse.headers['content-type'], 'text/plain; charset=utf-8')
  t.equal(httpsResponse.headers['x-custom-request-header'], 'want http/1')
  t.equal(httpsResponse.headers['x-custom-response-header'], 'using http/1')
  t.equal(Buffer.concat(httpsBody).toString('utf8'), 'hello http/1')
})
