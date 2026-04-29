require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { ensureWhatsAppClient, getStatus, initWhatsApp, roomForUser } = require('./services/whatsappService');
const { setIO } = require('./services/blastService');
const { requireAuth } = require('./middleware/auth');
const { getSession } = require('./services/appAuth');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const blastRoutes = require('./routes/blast');
const templateRoutes = require('./routes/templates');
const clusteringRoutes = require('./routes/clustering');
const banditRoutes = require('./routes/bandit');
const banditWorker = require('./services/banditWorker');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', requireAuth, contactRoutes);
app.use('/api/blast', requireAuth, blastRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/clustering', requireAuth, clusteringRoutes);
app.use('/api/bandit', requireAuth, banditRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Socket.io connection
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
    socket.handshake.query?.token;

  const session = getSession(token);
  if (!session) {
    return next(new Error('Unauthorized socket'));
  }

  socket.user = { username: session.username };
  return next();
});

io.on('connection', (socket) => {
  const username = socket.user?.username || 'default';
  socket.join(roomForUser(username));
  console.log(`Dashboard connected: ${socket.id} user=${username}`);

  // Send current WA status on connect (per user)
  ensureWhatsAppClient(username).catch(() => {});
  const status = getStatus(username);
  socket.emit('wa:status', status.status);
  if (status.qr) socket.emit('wa:qr', status.qr);
  // If already connected, also inform client which phone is connected
  if (status.status === 'connected' && status.phone) {
    socket.emit('wa:ready', { message: 'WhatsApp connected', phone: status.phone });
  }

  socket.on('disconnect', () => {
    console.log(`Dashboard disconnected: ${socket.id} user=${username}`);
  });
});

// Initialize socket reference for WhatsApp service
setIO(io);
initWhatsApp(io);
// start bandit background worker (if enabled)
banditWorker.start();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
