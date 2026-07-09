// backend/auth/src/handler.ts
import serverlessHttp from 'serverless-http';
import express from 'express';
import { login } from './login';
import { loginRequestSchema } from './schema';

export const app = express();
app.use(express.json());

app.post('/auth/login', async (req, res) => {
  const parseResult = loginRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const result = await login(parseResult.data);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const handler = serverlessHttp(app);
