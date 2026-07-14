import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const port = Number(process.env.PORT) || 8080
const ollamaHost = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '')

const app = express()
app.use(express.json({ limit: '50mb' }))

app.get('/api/ollama/tags', async (_req, res) => {
  try {
    const response = await fetch(`${ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch {
    return res.status(503).json({ models: [], error: 'Ollama unreachable' })
  }
})

app.post('/api/ollama/generate', async (req, res) => {
  try {
    const response = await fetch(`${ollamaHost}/api/generate`, {
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
})

app.use(express.static(distDir))

app.use((_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, '0.0.0.0', () => {
  console.log(`neuro-portrait listening on :${port}, ollama: ${ollamaHost}`)
})