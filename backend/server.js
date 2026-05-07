require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const session = require('express-session');

const { ensureWhatsAppClient, getStatus, initWhatsApp, roomForUser, destroyAllClients } = require('./services/whatsappService');
const { requireAuth } = require('./middleware/auth');
const { getSessionWithUser } = require('./services/googleAuthService');
const { configureGoogleStrategy } = require('./services/passportConfig');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const blastRoutes = require('./routes/blast');
const templateRoutes = require('./routes/templates');
const clusteringRoutes = require('./routes/clustering');
const banditRoutes = require('./routes/bandit');

const app = express();
const httpServer = http.createServer(app);
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

try {
  configureGoogleStrategy();
  console.log('Google OAuth strategy configured');
} catch (error) {
  console.warn('Google OAuth not configured:', error.message);
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth', authRoutes);

if (STORAGE_PROVIDER === 'firebase') {
  app.use('/api/contacts', requireAuth, contactRoutes);
  app.use('/api/templates', requireAuth, templateRoutes);
  app.use('/api/blast', requireAuth, blastRoutes);
  app.use('/api/clustering', requireAuth, clusteringRoutes);
  app.use('/api/bandit', requireAuth, banditRoutes);
  console.log('Running in FIREBASE mode: auth, contacts, templates, blast, clustering, and bandit are enabled.');
} else {
  app.use('/api/contacts', requireAuth, contactRoutes);
  app.use('/api/blast', requireAuth, blastRoutes);
  app.use('/api/templates', requireAuth, templateRoutes);
  app.use('/api/clustering', requireAuth, clusteringRoutes);
  app.use('/api/bandit', requireAuth, banditRoutes);
}

app.get('/api/health', (req, res) => {
  const banditEnabled = process.env.BANDIT_ENABLED === 'true';
  res.json({
    ok: true,
    storage: STORAGE_PROVIDER,
    features: {
      auth: true,
      contacts: true,
      templates: true,
      blast: true,
      clustering: STORAGE_PROVIDER === 'firebase',
      bandit: STORAGE_PROVIDER === 'firebase',
      banditOptimization: STORAGE_PROVIDER === 'firebase' && banditEnabled,
    },
  });
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') || socket.handshake.query?.token;

  try {
    const sessionData = await getSessionWithUser(token);
    if (!sessionData) return next(new Error('Unauthorized socket'));
    socket.user = { email: sessionData.user.email, name: sessionData.user.name };
    return next();
  } catch (error) {
    console.error('Socket auth error:', error);
    return next(new Error('Unauthorized socket'));
  }
});

io.on('connection', (socket) => {
  const email = socket.user?.email || 'default';
  socket.join(roomForUser(email));

  ensureWhatsAppClient(email).catch(() => {});
  const status = getStatus(email);
  socket.emit('wa:status', status.status);
  if (status.qr) socket.emit('wa:qr', status.qr);
  if (status.status === 'connected' && status.phone) {
    socket.emit('wa:ready', { message: 'WhatsApp connected', phone: status.phone });
  }
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  destroyAllClients().catch(() => {});
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  destroyAllClients().catch(() => {});
});

initWhatsApp(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Frontend should connect to: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
