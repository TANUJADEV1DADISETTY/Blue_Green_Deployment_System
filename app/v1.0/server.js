const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const port = process.env.PORT || 8080;
const appVersion = process.env.APP_VERSION || '1.0.0';
const envName = process.env.ENVIRONMENT_NAME || 'blue';

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

let isReady = false;

// Initialize DB schema for v1 if it doesn't exist (basic setup)
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL
      );
    `);
    console.log('Database initialized.');
    isReady = true;
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}
initDb();

// --- Health Checks ---

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Liveness probe
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'live' });
});

// Readiness probe
app.get('/health/ready', (req, res) => {
  if (isReady) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'service unavailable' });
  }
});

// --- Version Endpoint ---
app.get('/api/version', (req, res) => {
  res.status(200).json({
    version: appVersion,
    environment: envName
  });
});

// --- User CRUD Endpoints (v1.0) ---
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create User
app.post('/api/users', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ error: 'username and email are required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username, email',
      [username, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get User
app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
  const { username, email } = req.body;
  try {
    const check = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const result = await pool.query(
      'UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email) WHERE id = $3 RETURNING id, username, email',
      [username, email, req.params.id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete User
app.delete('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Graceful Shutdown ---
const server = app.listen(port, () => {
  console.log(`Blue app v1.0 listening on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Initiating graceful shutdown.');
  isReady = false; // Immediately fail readiness probe
  
  // Wait a brief period to allow inflight requests and load balancer draining
  setTimeout(() => {
    server.close(() => {
      console.log('HTTP server closed.');
      pool.end(() => {
        console.log('Database pool closed.');
        process.exit(0);
      });
    });
  }, 3000); // Wait 3 seconds for demo purposes
});
