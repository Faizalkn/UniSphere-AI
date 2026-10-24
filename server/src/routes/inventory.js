const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { pool, isPostgresAvailable } = require('../config/database');
const store = require('../data/inMemoryStore');

const router = express.Router();
const { suppliers: memorySuppliers } = store;
const memoryCategories = store.inventoryCategories;
const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  description: z.string().max(5000).optional().default(''),
  quantity: z.number().int().min(0),
  minStock: z.number().int().min(0).default(0),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  supplier: z.string().max(200).optional().default(''),
  supplierId: z.union([z.number().int().positive(), z.string().min(1)]).nullable().optional(),
  categoryId: z.union([z.number().int().positive(), z.string().min(1)]).nullable().optional(),
});

router.use(auth, authorize('admin', 'inventory_manager'));

router.get('/categories', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query('SELECT id,name FROM inventory_categories WHERE user_id=$1 ORDER BY name', [req.user.id]);
      return res.json({ success: true, categories: result.rows });
    }
    return res.json({ success: true, categories: memoryCategories.filter((category) => Number(category.user_id) === Number(req.user.id)) });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const category = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        'INSERT INTO inventory_categories (user_id,name) VALUES ($1,$2) RETURNING id,name',
        [req.user.id, category.name]
      );
      return res.status(201).json({ success: true, category: result.rows[0] });
    }
    if (memoryCategories.some((item) => Number(item.user_id) === Number(req.user.id) && item.name.toLowerCase() === category.name.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }
    const created = { id: `category-${Date.now()}`, user_id: Number(req.user.id), ...category };
    memoryCategories.push(created);
    return res.status(201).json({ success: true, category: created });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Category already exists' });
    next(error);
  }
});

router.get('/suppliers', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query('SELECT id, name, email, phone FROM suppliers WHERE user_id=$1 ORDER BY name', [req.user.id]);
      return res.json({ success: true, suppliers: result.rows });
    }
    return res.json({ success: true, suppliers: memorySuppliers.filter((supplier) => Number(supplier.user_id) === Number(req.user.id)) });
  } catch (error) {
    next(error);
  }
});

router.post('/suppliers', async (req, res, next) => {
  try {
    const supplier = z.object({
      name: z.string().trim().min(1).max(200),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(80).optional().default(''),
    }).parse(req.body);
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `INSERT INTO suppliers (user_id,name,email,phone) VALUES ($1,$2,$3,$4)
         RETURNING id,name,email,phone`,
        [req.user.id, supplier.name, supplier.email || null, supplier.phone]
      );
      return res.status(201).json({ success: true, supplier: result.rows[0] });
    }
    const created = { id: `supplier-${Date.now()}`, user_id: Number(req.user.id), ...supplier };
    memorySuppliers.push(created);
    return res.status(201).json({ success: true, supplier: created });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Supplier already exists' });
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT id, user_id, name, sku, category, category_id, description, quantity, min_stock, cost_price, sale_price, supplier, supplier_id, archived, created_at
         FROM inventory_items
         WHERE ($1 = '' OR name ILIKE $2 OR sku ILIKE $2 OR category ILIKE $2)
         AND archived = false
         ORDER BY name`,
        [search, `%${search}%`]
      );
      return res.json({ success: true, products: result.rows });
    }
    const products = store.inventory.filter((item) =>
      !item.archived && (!search || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
    );
    return res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  let connection;
  try {
    const product = productSchema.parse(req.body);
    if (await isPostgresAvailable()) {
      let categoryName = product.category;
      if (product.categoryId) {
        const category = await pool.query('SELECT id,name FROM inventory_categories WHERE id=$1 AND user_id=$2', [product.categoryId, req.user.id]);
        if (!category.rowCount) return res.status(400).json({ success: false, message: 'Invalid category for this account' });
        categoryName = category.rows[0].name;
      }
      if (product.supplierId) {
        const supplier = await pool.query('SELECT id FROM suppliers WHERE id=$1 AND user_id=$2', [product.supplierId, req.user.id]);
        if (!supplier.rowCount) return res.status(400).json({ success: false, message: 'Invalid supplier for this account' });
      }
      connection = await pool.connect();
      await connection.query('BEGIN');
      const result = await connection.query(
        `INSERT INTO inventory_items (user_id, name, sku, category, category_id, description, quantity, min_stock, cost_price, sale_price, supplier, supplier_id, archived)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)
         RETURNING id, user_id, name, sku, category, description, quantity, min_stock, cost_price, sale_price, supplier, archived, created_at`,
        [req.user.id, product.name, product.sku, categoryName, product.categoryId || null, product.description, product.quantity, product.minStock, product.costPrice, product.salePrice, product.supplier, product.supplierId || null]
      );
      if (product.quantity > 0) {
        await connection.query(
          `INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, note)
           VALUES ($1,$2,'in',$3,'Opening stock')`,
          [result.rows[0].id, req.user.id, product.quantity]
        );
      }
      await connection.query('COMMIT');
      return res.status(201).json({ success: true, product: result.rows[0] });
    }
    if (store.inventory.some((item) => item.sku.toLowerCase() === product.sku.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'SKU already exists' });
    }
    if (product.supplierId && !memorySuppliers.some((supplier) =>
      String(supplier.id) === String(product.supplierId) && Number(supplier.user_id) === Number(req.user.id)
    )) return res.status(400).json({ success: false, message: 'Invalid supplier for this account' });
    if (product.categoryId && !memoryCategories.some((category) =>
      String(category.id) === String(product.categoryId) && Number(category.user_id) === Number(req.user.id)
    )) return res.status(400).json({ success: false, message: 'Invalid category for this account' });
    const created = {
      ...product,
      category: memoryCategories.find((item) => String(item.id) === String(product.categoryId))?.name || product.category,
      id: `product-${Date.now()}`,
      user_id: Number(req.user.id),
      min_stock: product.minStock,
      cost_price: product.costPrice,
      sale_price: product.salePrice,
      archived: false,
      created_at: new Date().toISOString(),
    };
    store.inventory.unshift(created);
    if (product.quantity) {
      store.stockMovements.unshift({
        id: `movement-${Date.now()}`,
        product_id: created.id,
        user_id: Number(req.user.id),
        movement_type: 'in',
        quantity: product.quantity,
        note: 'Opening stock',
        created_at: created.created_at,
      });
    }
    return res.status(201).json({ success: true, product: created });
  } catch (error) {
    if (connection) await connection.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'SKU already exists' });
    next(error);
  } finally {
    connection?.release();
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const product = productSchema.partial().parse(req.body);
    if (!Object.keys(product).length) return res.status(400).json({ success: false, message: 'At least one product field is required' });
    if ('quantity' in product) return res.status(400).json({ success: false, message: 'Use stock movements to change quantity' });
    if (await isPostgresAvailable()) {
      if (product.categoryId) {
        const category = await pool.query('SELECT name FROM inventory_categories WHERE id=$1 AND user_id=$2', [product.categoryId, req.user.id]);
        if (!category.rowCount) return res.status(400).json({ success: false, message: 'Invalid category for this account' });
        product.category = category.rows[0].name;
      }
      if (product.supplierId) {
        const supplier = await pool.query('SELECT id FROM suppliers WHERE id=$1 AND user_id=$2', [product.supplierId, req.user.id]);
        if (!supplier.rowCount) return res.status(400).json({ success: false, message: 'Invalid supplier for this account' });
      }
      const fields = { name: 'name', sku: 'sku', category: 'category', categoryId: 'category_id', description: 'description', minStock: 'min_stock', costPrice: 'cost_price', salePrice: 'sale_price', supplier: 'supplier', supplierId: 'supplier_id' };
      const keys = Object.keys(product);
      const values = keys.map((key) => product[key]);
      values.push(req.params.id);
      const assignments = keys.map((key, index) => `${fields[key]} = $${index + 1}`);
      const result = await pool.query(
        `UPDATE inventory_items SET ${assignments.join(', ')} WHERE id = $${values.length} AND archived = false
         RETURNING id, name, sku, category, description, quantity, min_stock, cost_price, sale_price, supplier, archived`,
        values
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Product not found' });
      return res.json({ success: true, product: result.rows[0] });
    }
    const found = store.inventory.find((item) => item.id === req.params.id && !item.archived);
    if (!found) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.sku && store.inventory.some((item) => item.id !== found.id && item.sku.toLowerCase() === product.sku.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'SKU already exists' });
    }
    if (product.supplierId && !memorySuppliers.some((supplier) =>
      String(supplier.id) === String(product.supplierId) && Number(supplier.user_id) === Number(req.user.id)
    )) return res.status(400).json({ success: false, message: 'Invalid supplier for this account' });
    if (product.categoryId && !memoryCategories.some((category) =>
      String(category.id) === String(product.categoryId) && Number(category.user_id) === Number(req.user.id)
    )) return res.status(400).json({ success: false, message: 'Invalid category for this account' });
    const { minStock, costPrice, salePrice, categoryId, supplierId, ...rest } = product;
    Object.assign(found, rest);
    if (minStock !== undefined) found.min_stock = minStock;
    if (costPrice !== undefined) found.cost_price = costPrice;
    if (salePrice !== undefined) found.sale_price = salePrice;
    if (categoryId !== undefined) {
      found.category_id = categoryId;
      found.category = memoryCategories.find((item) => String(item.id) === String(categoryId))?.name || product.category || found.category;
    }
    if (supplierId !== undefined) found.supplier_id = supplierId;
    return res.json({ success: true, product: found });
  } catch (error) {
    next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        'UPDATE inventory_items SET archived = true WHERE id = $1 AND archived = false RETURNING id',
        [req.params.id]
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Product not found' });
    } else {
      const found = store.inventory.find((item) => item.id === req.params.id && !item.archived);
      if (!found) return res.status(404).json({ success: false, message: 'Product not found' });
      found.archived = true;
    }
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/products/:id/movements', async (req, res, next) => {
  const payloadSchema = z.object({
    type: z.enum(['in', 'out', 'adjustment']),
    quantity: z.number().int().positive(),
    note: z.string().max(500).optional().default(''),
  });
  let connection;
  try {
    const payload = payloadSchema.parse(req.body);
    const delta = payload.type === 'in' ? payload.quantity : payload.type === 'out' ? -payload.quantity : null;
    if (await isPostgresAvailable()) {
      connection = await pool.connect();
      await connection.query('BEGIN');
      const found = await connection.query(
        'SELECT id, quantity FROM inventory_items WHERE id = $1 AND archived = false FOR UPDATE',
        [req.params.id]
      );
      if (!found.rowCount) {
        await connection.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      const nextQuantity = payload.type === 'adjustment' ? payload.quantity : Number(found.rows[0].quantity) + delta;
      if (nextQuantity < 0) {
        await connection.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Stock movement would make inventory negative' });
      }
      await connection.query('UPDATE inventory_items SET quantity = $1 WHERE id = $2', [nextQuantity, req.params.id]);
      const movement = await connection.query(
        `INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, note)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, product_id, user_id, movement_type, quantity, note, created_at`,
        [req.params.id, req.user.id, payload.type, payload.quantity, payload.note]
      );
      await connection.query('COMMIT');
      return res.status(201).json({ success: true, movement: movement.rows[0], quantity: nextQuantity });
    }
    const found = store.inventory.find((item) => item.id === req.params.id && !item.archived);
    if (!found) return res.status(404).json({ success: false, message: 'Product not found' });
    const nextQuantity = payload.type === 'adjustment' ? payload.quantity : found.quantity + delta;
    if (nextQuantity < 0) return res.status(409).json({ success: false, message: 'Stock movement would make inventory negative' });
    found.quantity = nextQuantity;
    const movement = {
      id: `movement-${Date.now()}`,
      product_id: found.id,
      user_id: Number(req.user.id),
      movement_type: payload.type,
      quantity: payload.quantity,
      note: payload.note,
      created_at: new Date().toISOString(),
    };
    store.stockMovements.unshift(movement);
    return res.status(201).json({ success: true, movement, quantity: nextQuantity });
  } catch (error) {
    if (connection) await connection.query('ROLLBACK');
    next(error);
  } finally {
    connection?.release();
  }
});

router.get('/movements', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT m.id, m.product_id, p.name AS product_name, p.sku, m.user_id, m.movement_type, m.quantity, m.note, m.created_at
         FROM stock_movements m JOIN inventory_items p ON p.id = m.product_id
         ORDER BY m.created_at DESC LIMIT 100`
      );
      return res.json({ success: true, movements: result.rows });
    }
    const movements = store.stockMovements.map((movement) => ({
      ...movement,
      product_name: store.inventory.find((product) => product.id === movement.product_id)?.name || 'Archived product',
    })).slice(0, 100);
    return res.json({ success: true, movements });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS total_products,
                COALESCE(SUM(quantity * cost_price), 0)::numeric AS inventory_value,
                COUNT(*) FILTER (WHERE quantity <= min_stock AND quantity > 0)::int AS low_stock,
                COUNT(*) FILTER (WHERE quantity = 0)::int AS out_of_stock
         FROM inventory_items WHERE archived = false`
      );
      const movements = await pool.query(
        `SELECT DATE_TRUNC('day', created_at)::date AS day,
                SUM(CASE WHEN movement_type = 'in' THEN quantity ELSE -quantity END)::int AS net_quantity
         FROM stock_movements WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY day ORDER BY day`
      );
      return res.json({ success: true, analytics: { ...result.rows[0], movement_trend: movements.rows } });
    }
    const products = store.inventory.filter((item) => !item.archived);
    return res.json({
      success: true,
      analytics: {
        total_products: products.length,
        inventory_value: products.reduce((sum, product) => sum + product.quantity * Number(product.cost_price), 0),
        low_stock: products.filter((product) => product.quantity > 0 && product.quantity <= product.min_stock).length,
        out_of_stock: products.filter((product) => product.quantity === 0).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export.csv', async (req, res, next) => {
  try {
    const products = (await isPostgresAvailable())
      ? (await pool.query('SELECT name, sku, category, quantity, min_stock, cost_price, sale_price, supplier FROM inventory_items WHERE archived = false ORDER BY name')).rows
      : store.inventory.filter((item) => !item.archived);
    const columns = ['name', 'sku', 'category', 'quantity', 'min_stock', 'cost_price', 'sale_price', 'supplier'];
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns.join(','), ...products.map((product) => columns.map((key) => quote(product[key])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
    return res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
