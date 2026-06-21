import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool, { initDB } from './db/connection.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import notificationRoutes from './routes/notifications.js';
import userRoutes from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

app.get('/api/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ projects: [], tasks: [] });
    }

    const [projects] = await pool.query(
      `SELECT id, name, description, color, status FROM projects WHERE name LIKE ? OR description LIKE ? LIMIT 10`,
      [`%${q}%`, `%${q}%`]
    );

    const [tasks] = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name as project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.title LIKE ? OR t.description LIKE ?
       LIMIT 10`,
      [`%${q}%`, `%${q}%`]
    );

    res.json({ projects, tasks });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
