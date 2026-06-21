import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import pool, { initDB } from './connection.js';

const users = [
  { id: uuid(), name: 'Alice Johnson', email: 'alice@example.com', password: 'password123', avatar_url: null, role: 'admin' },
  { id: uuid(), name: 'Bob Smith', email: 'bob@example.com', password: 'password123', avatar_url: null, role: 'member' },
  { id: uuid(), name: 'Carol White', email: 'carol@example.com', password: 'password123', avatar_url: null, role: 'member' },
  { id: uuid(), name: 'David Lee', email: 'david@example.com', password: 'password123', avatar_url: null, role: 'member' }
];

const projects = [
  { id: uuid(), name: 'Website Redesign', description: 'Complete redesign of the company website with modern UI/UX', color: '#6366f1', due_date: '2026-07-30', status: 'Active', owner_id: users[0].id },
  { id: uuid(), name: 'Mobile App v2', description: 'Build the next version of the mobile app with new features', color: '#f59e0b', due_date: '2026-08-15', status: 'Active', owner_id: users[0].id },
  { id: uuid(), name: 'API Migration', description: 'Migrate legacy REST APIs to GraphQL', color: '#10b981', due_date: '2026-06-30', status: 'On Hold', owner_id: users[1].id }
];

const seed = async () => {
  try {
    await initDB();

    for (const u of users) {
      u.password = await bcrypt.hash(u.password, 10);
      await pool.query(
        'INSERT INTO users (id, name, email, password, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)',
        [u.id, u.name, u.email, u.password, u.avatar_url, u.role]
      );
    }
    console.log(`Seeded ${users.length} users`);

    for (const p of projects) {
      await pool.query(
        'INSERT INTO projects (id, name, description, color, due_date, status, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.description, p.color, p.due_date, p.status, p.owner_id]
      );
    }
    console.log(`Seeded ${projects.length} projects`);

    const projectMembers = [
      { id: uuid(), project_id: projects[0].id, user_id: users[0].id, role: 'lead' },
      { id: uuid(), project_id: projects[0].id, user_id: users[1].id, role: 'member' },
      { id: uuid(), project_id: projects[0].id, user_id: users[2].id, role: 'member' },
      { id: uuid(), project_id: projects[1].id, user_id: users[0].id, role: 'lead' },
      { id: uuid(), project_id: projects[1].id, user_id: users[3].id, role: 'member' },
      { id: uuid(), project_id: projects[2].id, user_id: users[1].id, role: 'lead' },
      { id: uuid(), project_id: projects[2].id, user_id: users[2].id, role: 'member' }
    ];
    for (const pm of projectMembers) {
      await pool.query(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
        [pm.id, pm.project_id, pm.user_id, pm.role]
      );
    }
    console.log(`Seeded ${projectMembers.length} project members`);

    const statuses = ['To Do', 'In Progress', 'In Review', 'Done'];
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    const taskData = [
      { project_id: projects[0].id, title: 'Design homepage mockup', status: 'Done', priority: 'High', assignee_id: users[2].id, position: 1 },
      { project_id: projects[0].id, title: 'Set up CI/CD pipeline', status: 'In Progress', priority: 'High', assignee_id: users[1].id, position: 2 },
      { project_id: projects[0].id, title: 'Implement responsive nav', status: 'In Review', priority: 'Medium', assignee_id: users[1].id, position: 3 },
      { project_id: projects[0].id, title: 'Create about page', status: 'To Do', priority: 'Low', assignee_id: users[2].id, position: 4 },
      { project_id: projects[0].id, title: 'Set up analytics', status: 'To Do', priority: 'Medium', assignee_id: null, position: 5 },
      { project_id: projects[0].id, title: 'SEO optimization', status: 'To Do', priority: 'High', assignee_id: users[0].id, position: 6 },
      { project_id: projects[1].id, title: 'Design onboarding flow', status: 'In Progress', priority: 'Urgent', assignee_id: users[3].id, position: 1 },
      { project_id: projects[1].id, title: 'Implement push notifications', status: 'To Do', priority: 'High', assignee_id: users[0].id, position: 2 },
      { project_id: projects[1].id, title: 'Build settings screen', status: 'To Do', priority: 'Medium', assignee_id: users[3].id, position: 3 },
      { project_id: projects[1].id, title: 'Fix login crash on Android', status: 'In Progress', priority: 'Urgent', assignee_id: users[0].id, position: 4 },
      { project_id: projects[1].id, title: 'Add dark mode support', status: 'Done', priority: 'Low', assignee_id: users[3].id, position: 5 },
      { project_id: projects[2].id, title: 'Audit existing endpoints', status: 'Done', priority: 'High', assignee_id: users[1].id, position: 1 },
      { project_id: projects[2].id, title: 'Design GraphQL schema', status: 'In Review', priority: 'High', assignee_id: users[2].id, position: 2 },
      { project_id: projects[2].id, title: 'Write migration scripts', status: 'To Do', priority: 'Medium', assignee_id: users[2].id, position: 3 }
    ];

    const taskIds = [];
    for (const t of taskData) {
      const id = uuid();
      taskIds.push(id);
      await pool.query(
        'INSERT INTO tasks (id, project_id, title, status, priority, assignee_id, position, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, t.project_id, t.title, t.status, t.priority, t.assignee_id, t.position, '2026-07-15']
      );
    }
    console.log(`Seeded ${taskData.length} tasks`);

    const subtasks = [
      { task_id: taskIds[0], title: 'Research competitor designs', completed: true, position: 1 },
      { task_id: taskIds[0], title: 'Create wireframes', completed: true, position: 2 },
      { task_id: taskIds[0], title: 'Finalize color palette', completed: false, position: 3 },
      { task_id: taskIds[1], title: 'Configure GitHub Actions', completed: true, position: 1 },
      { task_id: taskIds[1], title: 'Add staging environment', completed: false, position: 2 },
      { task_id: taskIds[6], title: 'Sketch screen layouts', completed: true, position: 1 },
      { task_id: taskIds[6], title: 'User testing', completed: false, position: 2 }
    ];
    for (const st of subtasks) {
      await pool.query(
        'INSERT INTO subtasks (id, task_id, title, completed, position) VALUES (?, ?, ?, ?, ?)',
        [uuid(), st.task_id, st.title, st.completed, st.position]
      );
    }
    console.log(`Seeded ${subtasks.length} subtasks`);

    const labels = [
      { task_id: taskIds[0], label: 'Design', color: '#8b5cf6' },
      { task_id: taskIds[1], label: 'DevOps', color: '#ef4444' },
      { task_id: taskIds[3], label: 'Frontend', color: '#3b82f6' },
      { task_id: taskIds[6], label: 'UX', color: '#f59e0b' },
      { task_id: taskIds[9], label: 'Bug', color: '#ef4444' },
      { task_id: taskIds[9], label: 'Critical', color: '#dc2626' }
    ];
    for (const lb of labels) {
      await pool.query(
        'INSERT INTO task_labels (id, task_id, label, color) VALUES (?, ?, ?, ?)',
        [uuid(), lb.task_id, lb.label, lb.color]
      );
    }
    console.log(`Seeded ${labels.length} labels`);

    const comments = [
      { task_id: taskIds[0], user_id: users[0].id, content: 'Great work on the mockups! Let me review the color scheme.' },
      { task_id: taskIds[0], user_id: users[2].id, content: 'Thanks! I updated the palette based on your feedback.' },
      { task_id: taskIds[1], user_id: users[1].id, content: 'CI/CD pipeline is almost ready. Need to configure staging.' },
      { task_id: taskIds[6], user_id: users[3].id, content: 'Onboarding flow sketches are done, please review.' },
      { task_id: taskIds[9], user_id: users[0].id, content: 'This is critical - app crashes on login for Android 14 users.' }
    ];
    for (const c of comments) {
      await pool.query(
        'INSERT INTO comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)',
        [uuid(), c.task_id, c.user_id, c.content]
      );
    }
    console.log(`Seeded ${comments.length} comments`);

    const activities = [
      { project_id: projects[0].id, user_id: users[0].id, action: 'created_project', entity_type: 'project', entity_id: projects[0].id, details: { name: 'Website Redesign' } },
      { project_id: projects[0].id, user_id: users[2].id, action: 'created_task', entity_type: 'task', entity_id: taskIds[0], details: { title: 'Design homepage mockup' } },
      { project_id: projects[0].id, user_id: users[2].id, action: 'moved_task', entity_type: 'task', entity_id: taskIds[0], details: { title: 'Design homepage mockup', from: 'In Progress', to: 'Done' } }
    ];
    for (const a of activities) {
      await pool.query(
        'INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuid(), a.project_id, a.user_id, a.action, a.entity_type, a.entity_id, JSON.stringify(a.details)]
      );
    }
    console.log(`Seeded ${activities.length} activity entries`);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
