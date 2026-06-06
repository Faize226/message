import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initSocketServer } from './src/lib/socket'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  initSocketServer(httpServer)

  httpServer.listen(3000, () => {
    console.log('> Ready on http://localhost:3000')
  })
})
