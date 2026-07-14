import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const host = process.env.OLLAMA_HOST?.replace(/\/$/, '')
  if (!host) {
    return res.status(503).json({ error: 'OLLAMA_HOST not configured' })
  }

  try {
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(120000),
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch {
    return res.status(503).json({ error: 'Ollama unreachable' })
  }
}