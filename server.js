require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');

const User = require('./models/User');
const Todo = require('./models/Todo');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Trust reverse proxy (required for Vercel and production reverse proxies)
app.set('trust proxy', 1);

// -----------------------------------------------------------------------------
// Database Connection (Cached Mongoose for Serverless & Vercel)
// -----------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (!MONGODB_URI) {
    console.warn('[TaskFlow Warning] MONGODB_URI is not set.');
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI)
      .then((mongooseInstance) => {
        console.log('✓ Successfully connected to MongoDB database.');
        return mongooseInstance;
      })
      .catch((err) => {
        cached.promise = null;
        console.error('✕ MongoDB connection error:', err.message);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

// Initialize connection
connectDB().catch(() => {});

// Ensure DB connection is active on incoming requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    // Error logged in connectDB
  }
  next();
});

// -----------------------------------------------------------------------------
// Middleware & Session Configuration
// -----------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'taskflow-secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
  }
};

if (MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60 // 14 days
  });
}

app.use(session(sessionConfig));

// -----------------------------------------------------------------------------
// Passport & Google OAuth 2.0 Configuration
// -----------------------------------------------------------------------------
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id || user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    await connectDB();
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Build callback URL from BASE_URL
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const callbackURL = `${BASE_URL}/auth/google/callback`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          await connectDB();
          let user = await User.findOne({ googleId: profile.id });
          const email =
            profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase().trim() : '';
          const name =
            profile.displayName ||
            (profile.name ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim() : 'Google User');
          const picture =
            profile.photos && profile.photos[0] ? profile.photos[0].value : '';

          if (!user) {
            if (email) {
              user = await User.findOne({ email });
            }
            if (user) {
              user.googleId = profile.id;
              if (!user.picture && picture) user.picture = picture;
              if (!user.name && name) user.name = name;
              await user.save();
            } else {
              user = await User.create({
                googleId: profile.id,
                name: name,
                email: email,
                picture: picture
              });
              // New users start with an empty list
            }
          } else {
            let updated = false;
            if (picture && user.picture !== picture) {
              user.picture = picture;
              updated = true;
            }
            if (name && (!user.name || user.name === 'Friend')) {
              user.name = name;
              updated = true;
            }
            if (email && !user.email) {
              user.email = email;
              updated = true;
            }
            if (updated) {
              await user.save();
            }
          }

          return done(null, user);
        } catch (err) {
          console.error('Google OAuth verify error:', err);
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn(
    '[TaskFlow Warning] GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET are not set. Google OAuth requires these credentials.'
  );
}

// -----------------------------------------------------------------------------
// Auth & Protection Middlewares
// -----------------------------------------------------------------------------
function requireAuthPage(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/');
  }
  return next();
}

function requireApiAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Please sign in with Google' });
}

// -----------------------------------------------------------------------------
// Authentication Routes (Google OAuth 2.0 Only)
// -----------------------------------------------------------------------------

// Initiate Google OAuth 2.0
app.get('/auth/google', (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect('/login?error=no_credentials');
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
});

// Google OAuth Callback
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed'
  }),
  (req, res) => {
    res.redirect('/');
  }
);

// Sign Out (GET & POST)
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error('Logout error:', err);
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
      });
    } else {
      res.redirect('/login');
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error('Logout error:', err);
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });
});

// Current Authenticated User
app.get('/api/auth/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized: Please log in' });
  }

  const user = req.user;
  res.json({
    user: {
      id: user.id || (user._id ? user._id.toString() : ''),
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      picture: user.picture
    }
  });
});

// Update User Display Name
app.post('/api/auth/set-name', requireApiAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  const cleanName = name.trim().slice(0, 50);
  try {
    await connectDB();
    if (req.user._id) {
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { name: cleanName } },
        { new: true }
      );
      req.user.name = cleanName;
      return res.json({ user: updatedUser });
    } else {
      req.user.name = cleanName;
      return res.json({ user: req.user });
    }
  } catch (err) {
    console.error('Error updating name:', err);
    res.status(500).json({ error: 'Failed to update name' });
  }
});

// -----------------------------------------------------------------------------
// Protected To-Do API Endpoints (MongoDB Mongoose, Private per User)
// -----------------------------------------------------------------------------

// 1. GET /api/todos - Retrieve all tasks for current authenticated user
app.get('/api/todos', requireApiAuth, async (req, res) => {
  try {
    await connectDB();
    const userTodos = await Todo.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(userTodos);
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// 2. POST /api/todos - Create a task for current authenticated user
app.post('/api/todos', requireApiAuth, async (req, res) => {
  try {
    await connectDB();
    const { title, category, dueDate, important } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const cleanTitle = title.trim();
    if (cleanTitle.length > 250) {
      return res.status(400).json({ error: 'Title cannot exceed 250 characters' });
    }

    const validCategories = ['Personal', 'Work', 'Learning', 'Shopping'];
    const cleanCategory = validCategories.includes(category) ? category : 'Personal';
    const cleanDueDate =
      dueDate && typeof dueDate === 'string' && dueDate.trim()
        ? dueDate.trim().slice(0, 10)
        : new Date().toISOString().split('T')[0];
    const cleanImportant = Boolean(important);

    const newTodo = await Todo.create({
      userId: req.user._id,
      title: cleanTitle,
      category: cleanCategory,
      dueDate: cleanDueDate,
      important: cleanImportant,
      completed: false
    });

    res.status(201).json(newTodo);
  } catch (err) {
    console.error('Error creating todo:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// 3. PATCH /api/todos/:id - Update task for current authenticated user
app.patch('/api/todos/:id', requireApiAuth, async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { completed, title, category, dueDate, important } = req.body;
    const update = {};

    if (typeof completed === 'boolean') {
      update.completed = completed;
    }
    if (typeof title === 'string' && title.trim()) {
      update.title = title.trim().slice(0, 250);
    }
    const validCategories = ['Personal', 'Work', 'Learning', 'Shopping'];
    if (typeof category === 'string' && validCategories.includes(category)) {
      update.category = category;
    }
    if (typeof dueDate === 'string' && dueDate.trim()) {
      update.dueDate = dueDate.trim().slice(0, 10);
    }
    if (typeof important === 'boolean') {
      update.important = important;
    }

    const todo = await Todo.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { $set: update },
      { new: true }
    );

    if (!todo) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(todo);
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// 4. DELETE /api/todos/:id - Delete task for current authenticated user
app.delete('/api/todos/:id', requireApiAuth, async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const todo = await Todo.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!todo) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, removed: todo });
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// 5. POST /api/todos/clear-completed - Clear completed tasks for current user
app.post('/api/todos/clear-completed', requireApiAuth, async (req, res) => {
  try {
    await connectDB();
    const result = await Todo.deleteMany({ userId: req.user._id, completed: true });
    res.json({ success: true, clearedCount: result.deletedCount });
  } catch (err) {
    console.error('Error clearing completed tasks:', err);
    res.status(500).json({ error: 'Failed to clear completed tasks' });
  }
});

// -----------------------------------------------------------------------------
// Static Files & Page Routes (with authentication redirects)
// -----------------------------------------------------------------------------

// Dedicated Login Page
app.get('/login', redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// App Dashboard (Protected)
app.get('/', requireAuthPage, async (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf-8', async (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    const userSafe = JSON.stringify({
      id: req.user.id || (req.user._id ? req.user._id.toString() : ''),
      name: req.user.name || 'Friend',
      email: req.user.email || '',
      picture: req.user.picture || ''
    });

    let initialTodosJson = '[]';
    try {
      if (req.user._id) {
        await connectDB();
        const userTodos = await Todo.find({ userId: req.user._id }).sort({ createdAt: -1 });
        initialTodosJson = JSON.stringify(userTodos);
      }
    } catch (e) {
      console.warn('Error prefetching todos for initial render:', e.message);
    }

    const injectedHtml = html.replace(
      '</head>',
      `<script>window.__INITIAL_USER__ = ${userSafe}; window.__INITIAL_TODOS__ = ${initialTodosJson};</script></head>`
    );
    res.send(injectedHtml);
  });
});

// Serve public assets (CSS, JS, SVG, images) without automatic index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Fallback route: protected SPA page or redirect to login
app.get('*', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.redirect('/login');
  }
});

// -----------------------------------------------------------------------------
// Start Server (only when not running in Vercel serverless environment)
// -----------------------------------------------------------------------------
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✓ TaskFlow server running at: ${BASE_URL}`);
    console.log(`✓ Google OAuth callback configured at: ${callbackURL}`);
  });
}

// Export Express app for Vercel Serverless Functions
module.exports = app;
