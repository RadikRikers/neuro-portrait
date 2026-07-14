import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = process.env.OLLAMA_HOST?.replace(/\/$/, '')
  if (!host) {
    return res.status(503).json({ models: [], error: 'OLLAMA_HOST not configured' })
  }

  try {
    const response = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch {
    return res.status(503).json({ models: [], error: 'Ollama unreachable' })
  }
}