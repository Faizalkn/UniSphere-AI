const OpenAI = require('openai');
const env = require('../config/env');

let client;

function getClient() {
  if (!env.openAiApiKey) {
    const error = new Error('AI provider is not configured. Set OPENAI_API_KEY on the server.');
    error.statusCode = 503;
    throw error;
  }
  if (!client) client = new OpenAI({ apiKey: env.openAiApiKey });
  return client;
}

async function embed(text) {
  const result = await getClient().embeddings.create({
    model: env.openAiEmbeddingModel,
    input: text.slice(0, 8000),
  });
  return result.data[0].embedding;
}

async function answer(question, sources, task = 'answer') {
  const context = sources.map((source, index) => `Source ${index + 1} (${source.title}):\n${source.content}`).join('\n\n');
  const result = await getClient().chat.completions.create({
    model: env.openAiModel,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You are a study assistant. Use only the supplied sources. If the answer is not supported, state that the provided materials do not contain enough information. Cite source numbers such as [1].',
      },
      {
        role: 'user',
        content: `${task}\nQuestion/request: ${question}\n\nSources:\n${context}`,
      },
    ],
  });
  return result.choices[0]?.message?.content?.trim() || '';
}

module.exports = { embed, answer };
