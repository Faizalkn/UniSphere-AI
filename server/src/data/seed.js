const bcrypt = require('bcryptjs');

const seedData = {
  users: [
    {
      id: 'admin-user',
      name: 'Alicia Admin',
      email: 'admin@unisphere.ai',
      passwordHash: bcrypt.hashSync('Password123!', 10),
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'student-user',
      name: 'Sam Student',
      email: 'student@unisphere.ai',
      passwordHash: bcrypt.hashSync('Password123!', 10),
      role: 'student',
      createdAt: new Date().toISOString(),
    },
  ],
  tasks: [
    {
      id: 'task-1',
      userId: 'student-user',
      title: 'Prepare calculus revision',
      description: 'Summarize derivatives and revisit practice problems.',
      category: 'Mathematics',
      priority: 'High',
      status: 'in_progress',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      tags: ['math', 'revision'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      userId: 'student-user',
      title: 'AI study notes review',
      description: 'Organize notes from the AI study assistant.',
      category: 'Study',
      priority: 'Medium',
      status: 'todo',
      dueDate: new Date(Date.now() + 172800000).toISOString(),
      tags: ['ai', 'notes'],
      createdAt: new Date().toISOString(),
    },
  ],
  notes: [
    {
      id: 'note-1',
      userId: 'student-user',
      title: 'RAG workflow',
      content: '# RAG workflow\n\nUse retrieved documents as grounding before answering.',
      category: 'AI',
      tags: ['rag', 'ai'],
      pinned: true,
      createdAt: new Date().toISOString(),
    },
  ],
  inventory: [
    {
      id: 'inv-1',
      userId: 'admin-user',
      name: 'Lab Notebook Pack',
      sku: 'LAB-001',
      category: 'Stationery',
      quantity: 18,
      minStock: 10,
      costPrice: 5,
      salePrice: 9,
      supplier: 'Campus Supply Co.',
      createdAt: new Date().toISOString(),
    },
  ],
};

module.exports = seedData;
