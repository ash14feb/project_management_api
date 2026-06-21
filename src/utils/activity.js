import { v4 as uuid } from 'uuid';
import pool from '../db/connection.js';

export default async function logActivity(projectId, userId, action, entityType, entityId, details = null) {
  try {
    await pool.query(
      'INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid(), projectId, userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}
