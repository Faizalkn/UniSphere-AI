const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

test('authenticated workspace APIs support CRUD and enforce roles', async () => {
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function login(email) {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!' }),
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }

  async function request(path, cookie, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
    });
    return { response, body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
  }

  try {
    const studentCookie = await login('student@unisphere.ai');
    const adminCookie = await login('admin@unisphere.ai');

    const created = await request('/tasks', studentCookie, {
      method: 'POST',
      body: JSON.stringify({ title: 'API test task', description: 'Created in test', priority: 'high' }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.task.title, 'API test task');

    const tasks = await request('/tasks', studentCookie);
    assert.ok(tasks.body.tasks.some((task) => task.id === created.body.task.id));

    const patch = await request(`/tasks/${created.body.task.id}`, studentCookie, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });
    assert.equal(patch.response.status, 200);

    const adminTasks = await request('/tasks', adminCookie);
    assert.equal(adminTasks.response.status, 200);
    assert.ok(!adminTasks.body.tasks.some((task) => task.id === created.body.task.id));

    const deniedInventory = await request('/inventory/products', studentCookie);
    assert.equal(deniedInventory.response.status, 403);

    const note = await request('/knowledge/notes', studentCookie, {
      method: 'POST',
      body: JSON.stringify({ title: 'Test note', content: 'Private test content', category: 'Testing' }),
    });
    assert.equal(note.response.status, 201);

    const goals = await request('/study/goals', studentCookie, {
      method: 'PUT',
      body: JSON.stringify({ dailyMinutes: 45, weeklyMinutes: 250 }),
    });
    assert.equal(goals.response.status, 200);
    assert.equal(goals.body.goals.dailyMinutes, 45);
    assert.equal(goals.body.goals.weeklyMinutes, 250);

    const question = await request('/study/ask', studentCookie, {
      method: 'POST',
      body: JSON.stringify({ question: 'What is in my study material?' }),
    });
    assert.equal(question.response.status, 200);
    const history = await request('/study/history', studentCookie);
    assert.ok(history.body.queries.some((item) => item.question === 'What is in my study material?'));

    const uploadForm = new FormData();
    uploadForm.append('file', new Blob(['This content is long enough to validate material uploads.']), 'test.txt');
    uploadForm.append('tags', '{invalid-json');
    const badUpload = await fetch(`${baseUrl}/study/materials/upload`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
      body: uploadForm,
    });
    assert.equal(badUpload.status, 400);

    const category = await request('/inventory/categories', adminCookie, {
      method: 'POST',
      body: JSON.stringify({ name: `API Category ${Date.now()}` }),
    });
    assert.equal(category.response.status, 201);
    const supplier = await request('/inventory/suppliers', adminCookie, {
      method: 'POST',
      body: JSON.stringify({ name: `API Supplier ${Date.now()}` }),
    });
    assert.equal(supplier.response.status, 201);
    const product = await request('/inventory/products', adminCookie, {
      method: 'POST',
      body: JSON.stringify({
        name: 'API Test Product',
        sku: `API-${Date.now()}`,
        category: category.body.category.name,
        categoryId: category.body.category.id,
        quantity: 5,
        supplier: supplier.body.supplier.name,
        supplierId: supplier.body.supplier.id,
      }),
    });
    assert.equal(product.response.status, 201);
    assert.equal(product.body.product.category, category.body.category.name);
    const products = await request('/inventory/products', adminCookie);
    const linkedProduct = products.body.products.find((item) => item.id === product.body.product.id);
    assert.equal(String(linkedProduct.category_id || linkedProduct.categoryId), String(category.body.category.id));
    assert.equal(String(linkedProduct.supplier_id || linkedProduct.supplierId), String(supplier.body.supplier.id));
    const stockOut = await request(`/inventory/products/${product.body.product.id}/movements`, adminCookie, {
      method: 'POST',
      body: JSON.stringify({ type: 'out', quantity: 2 }),
    });
    assert.equal(stockOut.response.status, 201);
    assert.equal(stockOut.body.quantity, 3);
    const negativeStock = await request(`/inventory/products/${product.body.product.id}/movements`, adminCookie, {
      method: 'POST',
      body: JSON.stringify({ type: 'out', quantity: 4 }),
    });
    assert.equal(negativeStock.response.status, 409);

    const dashboard = await request('/dashboard', studentCookie);
    assert.equal(dashboard.response.status, 200);
    assert.ok(dashboard.body.dashboard.totalTasks >= 1);

    const invalid = await request('/tasks', studentCookie, {
      method: 'POST',
      body: JSON.stringify({ title: '', priority: 'impossible' }),
    });
    assert.equal(invalid.response.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
