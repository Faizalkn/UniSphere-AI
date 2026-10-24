const bcrypt = require('bcryptjs');

const users = [
  {
    id: 1,
    name: 'Alicia Admin',
    email: 'admin@unisphere.ai',
    password_hash: bcrypt.hashSync('Password123!', 10),
    role: 'admin',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Sam Student',
    email: 'student@unisphere.ai',
    password_hash: bcrypt.hashSync('Password123!', 10),
    role: 'student',
    created_at: new Date().toISOString(),
  },
];

const tasks = [
  {
    id: 'task-1',
    user_id: 2,
    title: 'Prepare calculus revision',
    description: 'Review derivatives and complete practice problems.',
    category: 'Mathematics',
    priority: 'high',
    status: 'in_progress',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    tags: ['math', 'revision'],
    created_at: new Date().toISOString(),
  },
];

const notes = [
  {
    id: 'note-1',
    user_id: 2,
    title: 'RAG workflow',
    content: 'Retrieve relevant source documents before generating an answer.',
    category: 'AI',
    tags: ['rag', 'ai'],
    pinned: true,
    archived: false,
    created_at: new Date().toISOString(),
  },
];

const materials = [];
const inventory = [
  {
    id: 'product-1',
    user_id: 1,
    name: 'Lab Notebook Pack',
    sku: 'LAB-001',
    category: 'Stationery',
    description: 'Pack of laboratory notebooks',
    quantity: 18,
    min_stock: 10,
    cost_price: 5,
    sale_price: 9,
    supplier: 'Campus Supply Co.',
    archived: false,
    created_at: new Date().toISOString(),
  },
];

const suppliers = [{ id: 1, user_id: 1, name: 'Campus Supply Co.', email: '', phone: '' }];
const inventoryCategories = [{ id: 1, user_id: 1, name: 'Stationery' }];
const stockMovements = [];
const studySessions = [];
const studyQueries = [];
const savedAnswers = [];
const studyGoals = [];
const notifications = [];

function getUserByEmail(email) {
  return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
}

function getUserById(id) {
  return users.find((user) => Number(user.id) === Number(id));
}

function createUser({ name, email, passwordHash, role }) {
  const user = {
    id: users.length ? users[users.length - 1].id + 1 : 1,
    name,
    email,
    password_hash: passwordHash,
    role,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

function listUsers() {
  return users.map((user) => ({ ...user }));
}

module.exports = {
  users,
  tasks,
  notes,
  materials,
  inventory,
  suppliers,
  inventoryCategories,
  stockMovements,
  studySessions,
  studyQueries,
  savedAnswers,
  studyGoals,
  notifications,
  getUserByEmail,
  getUserById,
  createUser,
  listUsers,
};
