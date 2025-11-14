import mongoose from 'mongoose';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import server from '../index';

const { app, connectDB, Product } = server;

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  mongoServer = await MongoMemoryServer.create();
  await connectDB(mongoServer.getUri());

  const registerResp = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test Artisan',
      email: 'artisan@example.com',
      password: 'Passw0rd!',
      location: 'Jaipur',
    });

  expect(registerResp.status).toBe(201);
  token = registerResp.body.token;
});

beforeEach(async () => {
  await Product.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

describe('Product publishing flow', () => {
  it('moves a product from draft to published and exposes it via marketplace', async () => {
    const createResp = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Handmade Brass Lamp',
        description: 'Intricately etched brass lamp from Jaipur artisans.',
        price: 2499,
        category: 'Lighting',
        stock: 5,
        images: ['https://example.com/lamp.jpg'],
        status: 'draft',
      });

    expect(createResp.status).toBe(201);
    const productId = createResp.body.product._id;

    const publishResp = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });

    expect(publishResp.status).toBe(200);
    expect(publishResp.body.product.status).toBe('published');

    const marketplaceResp = await request(app)
      .get('/api/marketplace')
      .query({ q: 'lamp' });

    expect(marketplaceResp.status).toBe(200);
    const ids = marketplaceResp.body.products.map((item: { _id: string }) => item._id);
    expect(ids).toContain(productId);
  });
});

