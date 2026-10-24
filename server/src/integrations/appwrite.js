const { Client, DocumentsDB, TablesDB, VectorsDB, Query, ID } = require('node-appwrite');
const env = require('../config/env');

const configured = Boolean(
  env.appwriteProjectId
  && env.appwriteApiKey
  && env.appwriteTablesDatabaseId
  && env.appwriteDocumentsDatabaseId
  && env.appwriteVectorsDatabaseId
);
const client = new Client();
if (configured) {
  client.setEndpoint(env.appwriteEndpoint).setProject(env.appwriteProjectId).setKey(env.appwriteApiKey);
}

const documents = configured ? new DocumentsDB(client) : null;
const tables = configured ? new TablesDB(client) : null;
const vectors = configured ? new VectorsDB(client) : null;

function taskData(row) {
  let tags = row.tags;
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = [];
    }
  }
  return { ...row, id: row.$id, due_date: row.dueDate || null, completed_at: row.completedAt || null, tags: Array.isArray(tags) ? tags : [] };
}

async function listTasks(userId) {
  if (!configured) return null;
  const rows = await tables.listRows({
    databaseId: env.appwriteTablesDatabaseId,
    tableId: env.appwriteTasksTableId,
    queries: [Query.equal('userId', String(userId)), Query.limit(100)],
    total: false,
  });
  return rows.rows.map(taskData);
}

async function createTask(userId, task) {
  if (!configured) return null;
  const row = await tables.createRow({
    databaseId: env.appwriteTablesDatabaseId,
    tableId: env.appwriteTasksTableId,
    rowId: ID.unique(),
    data: {
      userId: String(userId),
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate || null,
      tags: JSON.stringify(task.tags),
      completedAt: task.status === 'completed' ? new Date().toISOString() : null,
    },
  });
  return taskData(row);
}

async function updateTask(userId, rowId, task) {
  if (!configured) return null;
  const row = await tables.getRow({ databaseId: env.appwriteTablesDatabaseId, tableId: env.appwriteTasksTableId, rowId });
  if (row.userId !== String(userId)) return null;
  const data = { ...task };
  if ('dueDate' in data) data.dueDate = data.dueDate || null;
  if ('tags' in data) data.tags = JSON.stringify(data.tags);
  if ('status' in data) data.completedAt = data.status === 'completed' ? new Date().toISOString() : null;
  const updated = await tables.updateRow({
    databaseId: env.appwriteTablesDatabaseId,
    tableId: env.appwriteTasksTableId,
    rowId,
    data,
  });
  return taskData(updated);
}

async function deleteTask(userId, rowId) {
  if (!configured) return false;
  const row = await tables.getRow({ databaseId: env.appwriteTablesDatabaseId, tableId: env.appwriteTasksTableId, rowId });
  if (row.userId !== String(userId)) return false;
  await tables.deleteRow({ databaseId: env.appwriteTablesDatabaseId, tableId: env.appwriteTasksTableId, rowId });
  return true;
}

async function listSessions(userId) {
  if (!configured) return null;
  const rows = await tables.listRows({
    databaseId: env.appwriteTablesDatabaseId,
    tableId: env.appwriteSessionsTableId,
    queries: [Query.equal('userId', String(userId)), Query.limit(100)],
    total: false,
  });
  return rows.rows.map((row) => ({ ...row, started_at: row.startedAt }));
}

async function createSession(userId, session) {
  if (!configured) return null;
  return tables.createRow({
    databaseId: env.appwriteTablesDatabaseId,
    tableId: env.appwriteSessionsTableId,
    rowId: ID.unique(),
    data: {
      userId: String(userId),
      subject: session.subject,
      durationMinutes: session.durationMinutes,
      notes: session.notes,
      startedAt: session.startedAt || new Date().toISOString(),
    },
  });
}

async function storeMaterial(userId, material, chunks) {
  if (!configured) return false;
  const saved = await documents.createDocument({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteMaterialsCollectionId,
    documentId: ID.unique(),
    data: {
      userId: String(userId),
      title: material.title,
      subject: material.subject,
      content: material.content,
      tags: material.tags,
      createdAt: material.created_at,
    },
  });
  for (const chunk of chunks) {
    if (!chunk.embedding) continue;
    await vectors.createDocument({
      databaseId: env.appwriteVectorsDatabaseId,
      collectionId: env.appwriteVectorCollectionId,
      documentId: ID.unique(),
      data: {
        embeddings: chunk.embedding,
        metadata: {
          userId: String(userId),
          title: material.title,
          subject: material.subject,
          content: chunk.content,
        },
      },
    });
  }
  return saved;
}

async function searchMaterials(userId, embedding, limit = 5) {
  if (!configured) return [];
  const result = await vectors.listDocuments({
    databaseId: env.appwriteVectorsDatabaseId,
    collectionId: env.appwriteVectorCollectionId,
    queries: [
      Query.equal('metadata.userId', String(userId)),
      Query.vectorCosine('embeddings', embedding),
      Query.limit(limit),
    ],
    total: false,
  });
  return result.documents.filter((document) => document.metadata?.userId === String(userId));
}

async function storeNote(userId, note) {
  if (!configured) return false;
  return documents.createDocument({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteNotesCollectionId,
    documentId: ID.unique(),
    data: {
      userId: String(userId),
      title: note.title,
      content: note.content,
      category: note.category,
      tags: note.tags,
      pinned: note.pinned,
      archived: note.archived,
      sourceUrl: note.sourceUrl || null,
      createdAt: note.created_at,
    },
  });
}

async function listNotes(userId) {
  if (!configured) return null;
  const result = await documents.listDocuments({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteNotesCollectionId,
    queries: [Query.equal('userId', String(userId)), Query.limit(100)],
    total: false,
  });
  return result.documents;
}

async function listMaterials(userId) {
  if (!configured) return null;
  const result = await documents.listDocuments({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteMaterialsCollectionId,
    queries: [Query.equal('userId', String(userId)), Query.limit(100)],
    total: false,
  });
  return result.documents;
}

async function updateNote(userId, documentId, note) {
  if (!configured) return null;
  const result = await documents.getDocument({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteNotesCollectionId,
    documentId,
  });
  if (result.userId !== String(userId)) return null;
  return documents.updateDocument({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteNotesCollectionId,
    documentId,
    data: note,
  });
}

async function deleteNote(userId, documentId) {
  if (!configured) return false;
  const result = await documents.getDocument({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteNotesCollectionId,
    documentId,
  });
  if (result.userId !== String(userId)) return false;
  await documents.deleteDocument({
    databaseId: env.appwriteDocumentsDatabaseId,
    collectionId: env.appwriteNotesCollectionId,
    documentId,
  });
  return true;
}

module.exports = {
  configured,
  storeMaterial,
  searchMaterials,
  storeNote,
  listNotes,
  listMaterials,
  updateNote,
  deleteNote,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listSessions,
  createSession,
};
