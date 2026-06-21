import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../db/connection.js';
import auth from '../middleware/auth.js';
import logActivity from '../utils/activity.js';

const router = Router();
router.use(auth);

router.get('/projects/:projectId/tasks', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status, priority, assignee, search } = req.query;

    let sql = 'SELECT t.*, u.name AS assignee_name, u.avatar_url AS assignee_avatar FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.project_id = ?';
    const params = [projectId];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }
    if (assignee) {
      sql += ' AND t.assignee_id = ?';
      params.push(assignee);
    }
    if (search) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY t.position ASC, t.created_at DESC';

    const [tasks] = await pool.query(sql, params);

    for (const task of tasks) {
      const [subtasks] = await pool.query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position', [task.id]);
      task.subtasks = subtasks;

      const [labels] = await pool.query('SELECT * FROM task_labels WHERE task_id = ?', [task.id]);
      task.labels = labels;
    }

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id', async (req, res, next) => {
  try {
    const [tasks] = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.avatar_url AS assignee_avatar
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];

    const [subtasks] = await pool.query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position', [task.id]);
    task.subtasks = subtasks;

    const [labels] = await pool.query('SELECT * FROM task_labels WHERE task_id = ?', [task.id]);
    task.labels = labels;

    const [comments] = await pool.query(
      `SELECT c.*, u.name AS user_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [task.id]
    );
    task.comments = comments;

    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/tasks', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, description, status, priority, due_date, assignee_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const [maxPos] = await pool.query(
      'SELECT MAX(position) as max_pos FROM tasks WHERE project_id = ?',
      [projectId]
    );
    const position = (maxPos[0].max_pos || 0) + 1;

    const id = uuid();
    const insertDueDate = due_date && due_date !== '' ? due_date : null;
    const insertAssigneeId = assignee_id && assignee_id !== '' ? assignee_id : null;

    await pool.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, title, description || null, status || 'To Do', priority || 'Medium', insertDueDate, insertAssigneeId, position]
    );

    await logActivity(projectId, req.user.id, 'created_task', 'task', id, { title });

    if (assignee_id) {
      await pool.query(
        'INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuid(), assignee_id, 'New task assigned', `You were assigned to "${title}"`, 'assignment', 'task', id]
      );
    }

    const [task] = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.avatar_url AS assignee_avatar
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`,
      [id]
    );
    task[0].subtasks = [];
    task[0].labels = [];

    res.status(201).json(task[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/tasks/:id', async (req, res, next) => {
  try {
    let { title, description, status, priority, due_date, assignee_id, position } = req.body;

    const [existing] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = existing[0];

    const newTitle = title !== undefined ? title : task.title;
    const newDescription = description !== undefined ? (description || null) : task.description;
    const newStatus = status !== undefined ? status : task.status;
    const newPriority = priority !== undefined ? priority : task.priority;
    const newDueDate = (due_date !== undefined && due_date !== '') ? due_date : (due_date === '' ? null : task.due_date);
    const newAssigneeId = (assignee_id !== undefined && assignee_id !== '') ? assignee_id : (assignee_id === '' ? null : task.assignee_id);
    const newPosition = position !== undefined ? position : task.position;

    await pool.query(
      `UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        due_date = ?, assignee_id = ?, position = ?
       WHERE id = ?`,
      [newTitle, newDescription, newStatus, newPriority, newDueDate, newAssigneeId, newPosition, req.params.id]
    );

    if (status && status !== task.status) {
      await logActivity(task.project_id, req.user.id, 'moved_task', 'task', task.id, { title: task.title, from: task.status, to: status });
    }

    if (assignee_id && assignee_id !== task.assignee_id) {
      await logActivity(task.project_id, req.user.id, 'assigned_task', 'task', task.id, { title: task.title });
      if (assignee_id) {
        await pool.query(
          'INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuid(), assignee_id, 'Task assigned', `You were assigned to "${task.title}"`, 'assignment', 'task', task.id]
        );
      }
    }

    const [updated] = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.avatar_url AS assignee_avatar
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`,
      [req.params.id]
    );
    const result = updated[0];

    const [subtasks] = await pool.query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position', [req.params.id]);
    result.subtasks = subtasks;

    const [labels] = await pool.query('SELECT * FROM task_labels WHERE task_id = ?', [req.params.id]);
    result.labels = labels;

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    await logActivity(existing[0].project_id, req.user.id, 'deleted_task', 'task', req.params.id, { title: existing[0].title });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/duplicate', async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const orig = existing[0];
    const [maxPos] = await pool.query(
      'SELECT MAX(position) as max_pos FROM tasks WHERE project_id = ?',
      [orig.project_id]
    );

    const newId = uuid();
    await pool.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, orig.project_id, `${orig.title} (Copy)`, orig.description, orig.status, orig.priority, orig.due_date, orig.assignee_id, (maxPos[0].max_pos || 0) + 1]
    );

    const [subtasks] = await pool.query('SELECT * FROM subtasks WHERE task_id = ?', [orig.id]);
    for (const st of subtasks) {
      await pool.query(
        'INSERT INTO subtasks (id, task_id, title, completed, position) VALUES (?, ?, ?, ?, ?)',
        [uuid(), newId, st.title, st.completed, st.position]
      );
    }

    const [labels] = await pool.query('SELECT * FROM task_labels WHERE task_id = ?', [orig.id]);
    for (const lb of labels) {
      await pool.query(
        'INSERT INTO task_labels (id, task_id, label, color) VALUES (?, ?, ?, ?)',
        [uuid(), newId, lb.label, lb.color]
      );
    }

    await logActivity(orig.project_id, req.user.id, 'duplicated_task', 'task', newId, { title: orig.title });

    const [task] = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.avatar_url AS assignee_avatar
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`,
      [newId]
    );
    const result = task[0];
    const [newSubtasks] = await pool.query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position', [newId]);
    result.subtasks = newSubtasks;
    const [newLabels] = await pool.query('SELECT * FROM task_labels WHERE task_id = ?', [newId]);
    result.labels = newLabels;

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/subtasks', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const [maxPos] = await pool.query(
      'SELECT MAX(position) as max_pos FROM subtasks WHERE task_id = ?',
      [req.params.id]
    );

    const id = uuid();
    await pool.query(
      'INSERT INTO subtasks (id, task_id, title, position) VALUES (?, ?, ?, ?)',
      [id, req.params.id, title, (maxPos[0].max_pos || 0) + 1]
    );

    const [subtask] = await pool.query('SELECT * FROM subtasks WHERE id = ?', [id]);
    res.status(201).json(subtask[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/subtasks/:id', async (req, res, next) => {
  try {
    const { completed, title } = req.body;
    const [existing] = await pool.query('SELECT * FROM subtasks WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    await pool.query(
      'UPDATE subtasks SET completed = ?, title = ? WHERE id = ?',
      [
        completed !== undefined ? completed : existing[0].completed,
        title || existing[0].title,
        req.params.id
      ]
    );

    const [subtask] = await pool.query('SELECT * FROM subtasks WHERE id = ?', [req.params.id]);
    res.json(subtask[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/subtasks/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM subtasks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Subtask deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/labels', async (req, res, next) => {
  try {
    const { label, color } = req.body;
    if (!label) {
      return res.status(400).json({ error: 'Label is required' });
    }

    const id = uuid();
    await pool.query(
      'INSERT INTO task_labels (id, task_id, label, color) VALUES (?, ?, ?, ?)',
      [id, req.params.id, label, color || '#6366f1']
    );

    const [lb] = await pool.query('SELECT * FROM task_labels WHERE id = ?', [id]);
    res.status(201).json(lb[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/labels/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM task_labels WHERE id = ?', [req.params.id]);
    res.json({ message: 'Label deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/comments', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const [task] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (task.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const id = uuid();
    await pool.query(
      'INSERT INTO comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)',
      [id, req.params.id, req.user.id, content]
    );

    await logActivity(task[0].project_id, req.user.id, 'commented_task', 'task', req.params.id, { title: task[0].title });

    const [comment] = await pool.query(
      `SELECT c.*, u.name AS user_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [id]
    );

    res.status(201).json(comment[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/tasks/:id/reorder', async (req, res, next) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates array is required' });
    }

    for (const update of updates) {
      await pool.query(
        'UPDATE tasks SET position = ?, status = ? WHERE id = ?',
        [update.position, update.status, update.id]
      );
    }

    res.json({ message: 'Tasks reordered' });
  } catch (err) {
    next(err);
  }
});

export default router;
