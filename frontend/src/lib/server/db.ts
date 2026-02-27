import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is required');
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

const cached = globalThis.mongooseCache ?? { conn: null, promise: null };
if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((mongooseInstance) => mongooseInstance);
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;
