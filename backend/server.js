require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initWhatsApp } = require('./services/whatsappService');
const { setIO } = require('./services/blastService');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const blastRoutes = require('./routes/blast');
const templateRoutes = require('./routes/templates');

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/blast', blastRoutes);
app.use('/api/templates', templateRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);

  // Send current WA status on connect
  const { getStatus } = require('./services/whatsappService');
  const status = getStatus();
  socket.emit('wa:status', status.status);
  if (status.qr) socket.emit('wa:qr', status.qr);

  socket.on('disconnect', () => {
    console.log('Dashboard disconnected:', socket.id);
  });
});

// Initialize WhatsApp client
setIO(io);
initWhatsApp(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
