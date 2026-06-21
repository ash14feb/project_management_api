import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../db/connection.js';
import auth from '../middleware/auth.js';
import logActivity from '../utils/activity.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'Done') AS done_count
       FROM projects p
       LEFT JOIN project_members pm2 ON pm2.project_id = p.id AND pm2.user_id = ?
       WHERE p.owner_id = ? OR pm2.user_id IS NOT NULL
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [members] = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, pm.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`,
      [req.params.id]
    );

    const [taskStats] = await pool.query(
      `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status`,
      [req.params.id]
    );

    const [totalTasks] = await pool.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completed
       FROM tasks WHERE project_id = ?`,
      [req.params.id]
    );

    const project = {
      ...projects[0],
      members,
      task_stats: taskStats,
      total_tasks: totalTasks[0].total,
      completed_tasks: totalTasks[0].completed || 0
    };

    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, color, due_date, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const id = uuid();
    await pool.query(
      'INSERT INTO projects (id, name, description, color, due_date, status, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, description || null, color || '#6366f1', due_date || null, status || 'Active', req.user.id]
    );

    await pool.query(
      'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuid(), id, req.user.id, 'lead']
    );

    await logActivity(id, req.user.id, 'created_project', 'project', id, { name });

    const [project] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(project[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, color, due_date, status } = req.body;
    const [existing] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await pool.query(
      'UPDATE projects SET name = ?, description = ?, color = ?, due_date = ?, status = ? WHERE id = ?',
      [
        name || existing[0].name,
        description !== undefined ? description : existing[0].description,
        color || existing[0].color,
        due_date !== undefined ? due_date : existing[0].due_date,
        status || existing[0].status,
        req.params.id
      ]
    );

    await logActivity(req.params.id, req.user.id, 'updated_project', 'project', req.params.id, { name: name || existing[0].name });

    const [project] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(project[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/members', async (req, res, next) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, user_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    const id = uuid();
    await pool.query(
      'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
      [id, req.params.id, user_id, role || 'member']
    );

    const [user] = await pool.query('SELECT name FROM users WHERE id = ?', [user_id]);
    await logActivity(req.params.id, req.user.id, 'added_member', 'member', user_id, { name: user[0]?.name });

    res.status(201).json({ id, project_id: req.params.id, user_id, role: role || 'member' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    await logActivity(req.params.id, req.user.id, 'removed_member', 'member', req.params.userId, null);
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/activity', async (req, res, next) => {
  try {
    const [activities] = await pool.query(
      `SELECT al.*, u.name AS user_name, u.avatar_url
       FROM activity_log al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.project_id = ?
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    res.json(activities);
  } catch (err) {
    next(err);
  }
});

export default router;
