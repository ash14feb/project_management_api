import { Router } from 'express';
import pool from '../db/connection.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, avatar_url, role FROM users ORDER BY name'
    );
    res.json(users);
  } catch (err) {
    next(err);
  }
});

export default router;
