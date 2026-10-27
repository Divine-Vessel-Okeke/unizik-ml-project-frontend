# Predictive Fraud Detection System for University E-Payment Portals (Final Year Project) — Frontend

## Setup Instructions

1. **Install dependencies:**

   ```
   npm install
   ```

2. **Configure environment variables** — create `.env` in the project root:

   ```
   DATABASE_URL="file:./dev.db"
   NODE_ENV="development"
   ML_ENGINE_URL = "http://127.0.0.1:5000/api/predict"
   ML_ENGINE_BASEURL = "http://127.0.0.1:5000/"
   ```

3. **Set up the database:**

   ```
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

   The seed creates demo accounts:

   - Student: `2022514001` / `password123`
   - Admin: `admin` / `admin123`

## Execution

1. **Start the development server:**

   ```
   npm run dev
   ```

   Portal available at `http://localhost:3000`.
