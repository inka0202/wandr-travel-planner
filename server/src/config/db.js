import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Node's c-ares resolver fails SRV lookups via router DNS on Windows;
// pointing at 8.8.8.8/1.1.1.1 fixes Atlas mongodb+srv:// connections.
// Dev-only workaround: in production it would override Render's resolver
// for the whole process.
if (env.IS_DEVELOPMENT) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

mongoose.set('strictQuery', true);

export const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: env.NODE_ENV !== 'production',
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
  mongoose.connection.on('error', (err) => console.error('MongoDB runtime error:', err));
  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
};
