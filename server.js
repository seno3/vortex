// Custom Next.js server with Socket.IO for real-time agent pipeline events.
// Run with: node server.js (replaces `next dev` / `next start`)
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIO } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIO(httpServer, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  // Make io accessible from Next.js API routes via global
  global.__socketIO = io;

  io.on('connection', (socket) => {
    // Clients join a room per tip to receive analysis pipeline events
    socket.on('join:tip', (tipId) => {
      if (typeof tipId === 'string') socket.join(`tip:${tipId}`);
    });
    socket.on('leave:tip', (tipId) => {
      if (typeof tipId === 'string') socket.leave(`tip:${tipId}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
