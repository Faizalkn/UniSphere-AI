const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  appwriteEndpoint: process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  appwriteProjectId: process.env.APPWRITE_PROJECT_ID || '',
  appwriteApiKey: process.env.APPWRITE_API_KEY || '',
  appwriteTablesDatabaseId: process.env.APPWRITE_TABLES_DATABASE_ID || process.env.APPWRITE_DATABASE_ID || '',
  appwriteDocumentsDatabaseId: process.env.APPWRITE_DOCUMENTS_DATABASE_ID || process.env.APPWRITE_DATABASE_ID || '',
  appwriteVectorsDatabaseId: process.env.APPWRITE_VECTORS_DATABASE_ID || process.env.APPWRITE_DATABASE_ID || '',
  appwriteTasksTableId: process.env.APPWRITE_TASKS_TABLE_ID || 'tasks',
  appwriteSessionsTableId: process.env.APPWRITE_SESSIONS_TABLE_ID || 'study_sessions',
  appwriteNotesCollectionId: process.env.APPWRITE_NOTES_COLLECTION_ID || 'notes',
  appwriteMaterialsCollectionId: process.env.APPWRITE_MATERIALS_COLLECTION_ID || 'study_materials',
  appwriteVectorCollectionId: process.env.APPWRITE_VECTOR_COLLECTION_ID || 'study_chunks',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openAiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || 'unisphere',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = env;
