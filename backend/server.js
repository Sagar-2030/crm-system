require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/error');

const app = express();
// Vercel terminates TLS at its proxy; trust the forwarded protocol for origin checks.
app.set('trust proxy', 1);

app.use(helmet());
const isSameOrigin = (req) => {
  const origin = req.get('Origin');
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === req.get('host') && parsedOrigin.protocol === `${req.protocol}:`;
  } catch { return false; }
};
const corsMiddleware = cors({
    origin(origin, callback) {
      const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
        .split(',').map((value) => value.trim()).filter(Boolean);
      const developmentOrigins = process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:5173', 'http://127.0.0.1:5173'];
      if (!origin || configuredOrigins.includes(origin) || developmentOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  });
app.use((req, res, next) => (isSameOrigin(req) ? next() : corsMiddleware(req, res, next)));
app.use(express.json({ limit: '100kb' }));

// Reuse the Mongoose connection across warm serverless invocations.
app.use((req, res, next) => {
  if (!process.env.JWT_SECRET) return next(new Error('JWT_SECRET is not configured'));
  connectDB().then(() => next()).catch(next);
});

// Throttle login attempts to slow down brute-force guessing
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/leads', require('./src/routes/leads'));
app.use('/api/contacts', require('./src/routes/contacts'));
app.use('/api/tasks', require('./src/routes/tasks'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/settings', require('./src/routes/settings'));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`CRM API listening on port ${PORT}`)))
    .catch((error) => {
      console.error(`CRM API startup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = app;
