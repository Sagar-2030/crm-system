const mongoose = require('mongoose');

let connectionPromise;
mongoose.connection.on('disconnected', () => {
  connectionPromise = undefined;
});

module.exports = async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: 10000,
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  await connectionPromise;
  return mongoose.connection;
};
