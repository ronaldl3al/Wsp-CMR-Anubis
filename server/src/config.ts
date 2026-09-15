import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:gCCXyCBIMdxogtHbohwYPKwFDgsDxTku@crossover.proxy.rlwy.net:26678/railway',
  evolution: {
    apiUrl: (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-c04d.up.railway.app').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '25C1E751E46C-4707-A439-99A8DB7F4D5A',
    instanceName: process.env.EVOLUTION_INSTANCE || 'ANUBIS STORE4'
  }
};
