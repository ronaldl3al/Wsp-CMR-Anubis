import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  evolution: {
    apiUrl: (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-c04d.up.railway.app').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11',
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'ANUBIS STORE'
  },
  backendUrl: (process.env.BACKEND_URL || 'https://wsp-cmr-anubis-production.up.railway.app').replace(/\/+$/, '')
};
