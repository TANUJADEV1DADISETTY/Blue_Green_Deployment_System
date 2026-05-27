const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const port = process.env.PORT || 8080;
const appVersion = process.env.APP_VERSION || '2.0.0';
const envName = process.env.ENVIRONMENT_NAME || 'green';

// Feature flags state
const features = {
  phoneNumber: process.env.FEATURE_PHONE_NUMBER_ENABLED === 'true',
  profilePicture: process.env.FEATURE_PROFILE_PICTURE_ENABLED === 'true'
};

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

let isReady = false;

// We assume migrations (expand) have been run, so table has new columns.
// But we still connect and mark ready.
pool.query('SELECT 1')
  .then(() => {
    console.log('Database connected.');
    isReady = true;
  })
  .catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

// --- Health Checks ---

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'live' });
});

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
    environment: envName,
    features: features
  });
});

// --- Feature Flags Endpoint ---
app.get('/api/features', (req, res) => {
  res.status(200).json(features);
});

app.put('/api/features/:name', (req, res) => {
  const { name } = req.params;
  const { enabled } = req.body;
  if (features.hasOwnProperty(name)) {
    features[name] = !!enabled;
    res.status(200).json({ message: `Feature ${name} updated.` });
  } else {
    res.status(404).json({ error: 'Feature not found' });
  }
});

// --- User CRUD Endpoints (v2.0) ---
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const users = result.rows.map(user => {
      if (!features.phoneNumber) delete user.phone_number;
      if (!features.profilePicture) delete user.profile_picture_url;
      return user;
    });
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create User
app.post('/api/users', async (req, res) => {
  const { username, email, phone_number, profile_picture_url } = req.body;
  if (!username || !email) {
    return res.status(400).json({ error: 'username and email are required' });
  }
  
  let cols = ['username', 'email'];
  let vals = [username, email];
  let placeholders = ['$1', '$2'];
  let paramIndex = 3;

  if (features.phoneNumber && phone_number !== undefined) {
    cols.push('phone_number');
    vals.push(phone_number);
    placeholders.push(`$${paramIndex++}`);
  }
  if (features.profilePicture && profile_picture_url !== undefined) {
    cols.push('profile_picture_url');
    vals.push(profile_picture_url);
    placeholders.push(`$${paramIndex++}`);
  }

  const query = `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  
  try {
    const result = await pool.query(query, vals);
    const user = result.rows[0];
    
    // Filter output based on feature flags
    if (!features.phoneNumber) delete user.phone_number;
    if (!features.profilePicture) delete user.profile_picture_url;
    
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get User
app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    if (!features.phoneNumber) delete user.phone_number;
    if (!features.profilePicture) delete user.profile_picture_url;

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
  const { username, email, phone_number, profile_picture_url } = req.body;
  try {
    const check = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let setClauses = [];
    let vals = [];
    let paramIndex = 1;

    if (username !== undefined) {
      setClauses.push(`username = $${paramIndex++}`);
      vals.push(username);
    }
    if (email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      vals.push(email);
    }
    if (features.phoneNumber && phone_number !== undefined) {
      setClauses.push(`phone_number = $${paramIndex++}`);
      vals.push(phone_number);
    }
    if (features.profilePicture && profile_picture_url !== undefined) {
      setClauses.push(`profile_picture_url = $${paramIndex++}`);
      vals.push(profile_picture_url);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    vals.push(req.params.id);
    const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await pool.query(query, vals);
    const user = result.rows[0];
    
    if (!features.phoneNumber) delete user.phone_number;
    if (!features.profilePicture) delete user.profile_picture_url;

    res.status(200).json(user);
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
  console.log(`Green app v2.0 listening on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Initiating graceful shutdown.');
  isReady = false; 
  
  setTimeout(() => {
    server.close(() => {
      console.log('HTTP server closed.');
      pool.end(() => {
        console.log('Database pool closed.');
        process.exit(0);
      });
    });
  }, 3000); 
});
