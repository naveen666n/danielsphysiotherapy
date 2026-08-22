import dotenv from 'dotenv';

dotenv.config();

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'test';
const isLiveMode = PAYMENT_MODE === 'live';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${Number(process.env.PORT) || 5000}`,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'physio_clinic',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrator',
  PAYMENT_MODE,
  PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'razorpay',
  RAZORPAY_KEY_ID: isLiveMode ? process.env.RAZORPAY_KEY_ID_LIVE : process.env.RAZORPAY_KEY_ID_TEST,
  RAZORPAY_KEY_SECRET: isLiveMode ? process.env.RAZORPAY_KEY_SECRET_LIVE : process.env.RAZORPAY_KEY_SECRET_TEST,
  SMTP_USER_NAME: process.env.SMTP_USER_NAME || '',
  SMTP_APP_PASSWORD: process.env.SMTP_APP_PASSWORD || '',
  CC_EMAILS: (process.env.CC_EMAILS || '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean),
};

export default env;
