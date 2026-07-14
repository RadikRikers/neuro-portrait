#!/usr/bin/env node
/**
 * Переносимый НейроПортрет: Node + Ollama + модель llama3.2 + лаунчеры.
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const NODE_VERSION = '20.19.0'
const OLLAMA_VERSION = 'v0.32.0'
const DEFAULT_MODEL = 'llama3.2'
const PORT = '8765'
const OLLAMA_PORT = '11434'

const NODE_RUNTIMES = [
  { id: 'win', archive: `node-v${NODE_VERSION}-win-x64.zip`, nodePath: 'node.exe', extract: 'zip' },
  { id: 'mac-arm64', archive: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`, nodePath: 'bin/node', extract: 'tar' },
  { id: 'mac-x64', archive: `node-v${NODE_VERSION}-darwin-x64.tar.gz`, nodePath: 'bin/node', extract: 'tar' },
  { id: 'linux', archive: `node-v${NODE_VERSION}-linux-x64.tar.gz`, nodePath: 'bin/node', extract: 'tar' },
]

const OLLAMA_RUNTIMES = [
  {
    id: 'mac',
    archive: 'ollama-darwin.tgz',
    url: `https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-darwin.tgz`,
    extract: 'tar',
    bin: 'ollama',
  },
  {
    id: 'win',
    archive: 'ollama-windows-amd64.zip',
    url: `https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-windows-amd64.zip`,
    extract: 'zip',
    bin: 'ollama.exe',
  },
  {
    id: 'linux',
    archive: 'ollama-linux-amd64.tar.zst',
    url: `https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-linux-amd64.tar.zst`,
    extract: 'tar-zst',
    bin: 'bin/ollama',
  },
]

const releaseName = `NeuroPortrait-${pkg.version}`
const releaseDir = path.join(rootDir, 'release', releaseName)
const appDir = path.join(releaseDir, 'app')
const runtimeDir = path.join(releaseDir, 'runtime')
const ollamaDir = path.join(releaseDir, 'ollama')
const ollamaDataDir = path.join(releaseDir, 'ollama-data')
const modelsDir = path.join(ollamaDataDir, 'models')

function log(step, msg) {
  console.log(`[${step}] ${msg}`)
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...opts,
  })
  if (result.status !== 0) {
    throw new Error(`Команда завершилась с ошибкой: ${cmd} ${args.join(' ')}`)
  }
}

function formatSize(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} ГБ`
  return `${Math.round(bytes / 1e6)} МБ`
}

function dirSize(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    try {
      total += entry.isDirectory() ? dirSize(p) : statSync(p).size
    } catch {
      /* broken symlinks in cuda libs */
    }
  }
  return total
}

async function download(url, dest) {
  if (existsSync(dest)) {
    log('cache', `Уже скачан: ${path.basename(dest)}`)
    return
  }
  log('download', url)

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(600_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
      return
    } catch (err) {
      log('download', `Попытка ${attempt}/5 не удалась: ${err.message}`)
      if (attempt === 5) break
      await new Promise((r) => setTimeout(r, 3000 * attempt))
    }
  }

  log('download', 'Пробуем curl...')
  const curl = spawnSync('curl', ['-fL', '--retry', '5', '--retry-delay', '3', '-o', dest, url], {
    stdio: 'inherit',
  })
  if (curl.status !== 0 || !existsSync(dest)) {
    throw new Error(`Не удалось скачать ${url}`)
  }
}

async function extractArchive(type, archivePath, destDir) {
  mkdirSync(destDir, { recursive: true })
  if (type === 'zip') {
    run('unzip', ['-qo', archivePath, '-d', destDir])
    return
  }
  if (type === 'tar') {
    run('tar', ['-xzf', archivePath, '-C', destDir])
    return
  }
  if (type === 'tar-zst') {
    const tarPath = archivePath.replace(/\.zst$/, '')
    if (!existsSync(tarPath)) {
      const zstd = spawnSync('zstd', ['-d', '-f', archivePath, '-o', tarPath], { stdio: 'inherit' })
      if (zstd.status !== 0) {
        throw new Error('Нужен zstd: brew install zstd (для распаковки Ollama Linux)')
      }
    }
    run('tar', ['-xf', tarPath, '-C', destDir])
  }
}

async function ensureNodeRuntime(runtime, cacheDir) {
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${runtime.archive}`
  const archivePath = path.join(cacheDir, runtime.archive)
  const extractRoot = path.join(runtimeDir, runtime.id)
  const nodeDest = path.join(extractRoot, runtime.nodePath)

  if (existsSync(nodeDest)) {
    log('node', `${runtime.id} — готов`)
    return
  }

  await download(url, archivePath)
  const tmpExtract = path.join(cacheDir, `extract-node-${runtime.id}`)
  rmSync(tmpExtract, { recursive: true, force: true })
  mkdirSync(tmpExtract, { recursive: true })
  await extractArchive(runtime.extract, archivePath, tmpExtract)

  const extractedFolder = path.join(
    tmpExtract,
    runtime.archive.replace(/\.tar\.gz$/, '').replace(/\.zip$/, ''),
  )
  const nodeSrc = path.join(extractedFolder, runtime.nodePath)
  if (!existsSync(nodeSrc)) throw new Error(`Node binary not found: ${nodeSrc}`)

  mkdirSync(path.dirname(nodeDest), { recursive: true })
  copyFileSync(nodeSrc, nodeDest)
  if (runtime.extract !== 'zip') chmodSync(nodeDest, 0o755)
  rmSync(tmpExtract, { recursive: true, force: true })
  log('node', `${runtime.id} — установлен`)
}

async function ensureOllamaRuntime(runtime, cacheDir) {
  const archivePath = path.join(cacheDir, runtime.archive)
  const destDir = path.join(ollamaDir, runtime.id)
  const binDest = path.join(destDir, runtime.bin)

  if (existsSync(binDest)) {
    log('ollama', `${runtime.id} — готов`)
    return
  }

  await download(runtime.url, archivePath)
  const tmpExtract = path.join(cacheDir, `extract-ollama-${runtime.id}`)
  rmSync(tmpExtract, { recursive: true, force: true })
  mkdirSync(tmpExtract, { recursive: true })
  await extractArchive(runtime.extract, archivePath, tmpExtract)

  rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })

  const entries = readdirSync(tmpExtract)
  const inner = entries.length === 1 && statSync(path.join(tmpExtract, entries[0])).isDirectory()
    ? path.join(tmpExtract, entries[0])
    : tmpExtract

  for (const name of readdirSync(inner)) {
    const src = path.join(inner, name)
    const dst = path.join(destDir, name)
    cpSync(src, dst, { recursive: true })
    if (!name.includes('.') || name.endsWith('.so') || name === runtime.bin || name === 'llama-server') {
      try { chmodSync(dst, 0o755) } catch { /* dirs */ }
    }
  }

  if (!existsSync(binDest)) throw new Error(`Ollama binary not found: ${binDest}`)
  chmodSync(binDest, 0o755)
  rmSync(tmpExtract, { recursive: true, force: true })
  log('ollama', `${runtime.id} — установлен`)
}

function hasModelInstalled(homeModels, model) {
  const manifestDir = path.join(homeModels, 'manifests', 'registry.ollama.ai', 'library', model)
  return existsSync(manifestDir)
}

async function bundleModels() {
  rmSync(modelsDir, { recursive: true, force: true })
  mkdirSync(modelsDir, { recursive: true })

  const homeModels = path.join(process.env.HOME || '', '.ollama', 'models')
  const ollamaBin = spawnSync('which', ['ollama'], { encoding: 'utf8' })
  const ollamaPath = ollamaBin.stdout?.trim()

  if (!ollamaPath) {
    throw new Error(
      'Для сборки нужен Ollama на машине разработчика: установите ollama и выполните `ollama pull llama3.2`',
    )
  }

  if (!hasModelInstalled(homeModels, DEFAULT_MODEL)) {
    log('model', `Скачивание ${DEFAULT_MODEL} (~2 ГБ) — один раз при сборке...`)
    run(ollamaPath, ['pull', DEFAULT_MODEL])
  }

  if (!hasModelInstalled(homeModels, DEFAULT_MODEL)) {
    throw new Error(`Модель ${DEFAULT_MODEL} не найдена после pull`)
  }

  log('model', `Копирование модели ${DEFAULT_MODEL} в сборку...`)
  cpSync(homeModels, modelsDir, { recursive: true })
  log('model', `Модели: ${formatSize(dirSize(modelsDir))}`)
}

function writeLaunchers() {
  const winBat = `@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
set PORT=${PORT}
set OPEN_BROWSER=1
set OLLAMA_HOST=127.0.0.1:${OLLAMA_PORT}
set OLLAMA_MODELS=%ROOT%ollama-data\\models
set OLLAMA_KEEP_ALIVE=24h

echo.
echo  НейроПортрет + Ollama AI — запуск...
echo.

cd /d "%ROOT%ollama\\win"
echo  [1/2] Запуск Ollama (${DEFAULT_MODEL})...
start /MIN "" ollama.exe serve
cd /d "%ROOT%"

set /a WAIT=0
:wait_ollama
timeout /t 2 /nobreak >nul
curl -sf http://127.0.0.1:${OLLAMA_PORT}/api/tags >nul 2>&1 && goto ollama_ready
set /a WAIT+=2
if %WAIT% GEQ 120 (
  echo  Ollama не запустился за 2 минуты.
  pause
  exit /b 1
)
goto wait_ollama

:ollama_ready
echo  [2/2] Запуск интерфейса...
cd /d "%ROOT%app"
"%ROOT%runtime\\win\\node.exe" server\\index.js

echo.
echo  Остановка Ollama...
taskkill /F /IM ollama.exe >nul 2>&1
pause
`

  const macCommand = `#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PORT=${PORT}
export OPEN_BROWSER=1
export OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}"
export OLLAMA_MODELS="$ROOT/ollama-data/models"
export OLLAMA_KEEP_ALIVE=24h

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  NODE="$ROOT/runtime/mac-arm64/bin/node"
else
  NODE="$ROOT/runtime/mac-x64/bin/node"
fi
OLLAMA_BIN="$ROOT/ollama/mac/ollama"

cleanup() {
  if [ -n "$OLLAMA_PID" ]; then
    kill "$OLLAMA_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo ""
echo "  НейроПортрет + Ollama AI — запуск..."
echo ""

cd "$ROOT/ollama/mac"
echo "  [1/2] Запуск Ollama (${DEFAULT_MODEL})..."
./ollama serve &
OLLAMA_PID=$!
cd "$ROOT"

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [ "$i" -eq 60 ]; then
    echo "  Ollama не запустился за 2 минуты."
    read -r -p "Enter..."
    exit 1
  fi
done

echo "  [2/2] Запуск интерфейса..."
cd "$ROOT/app"
"$NODE" server/index.js
`

  const linuxSh = `#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PORT=${PORT}
export OPEN_BROWSER=1
export OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}"
export OLLAMA_MODELS="$ROOT/ollama-data/models"
export OLLAMA_KEEP_ALIVE=24h

NODE="$ROOT/runtime/linux/bin/node"
OLLAMA_BIN="$ROOT/ollama/linux/ollama"

cleanup() {
  if [ -n "$OLLAMA_PID" ]; then
    kill "$OLLAMA_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo ""
echo "  НейроПортрет + Ollama AI — запуск..."
echo ""

cd "$ROOT/ollama/linux"
echo "  [1/2] Запуск Ollama (${DEFAULT_MODEL})..."
./bin/ollama serve &
OLLAMA_PID=$!
cd "$ROOT"

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [ "$i" -eq 60 ]; then
    echo "  Ollama не запустился за 2 минуты."
    read -r -p "Enter..."
    exit 1
  fi
done

echo "  [2/2] Запуск интерфейса..."
cd "$ROOT/app"
"$NODE" server/index.js
`

  writeFileSync(path.join(releaseDir, 'ЗАПУСК Windows.bat'), winBat, 'utf8')
  writeFileSync(path.join(releaseDir, 'ЗАПУСК macOS.command'), macCommand, 'utf8')
  writeFileSync(path.join(releaseDir, 'запуск Linux.sh'), linuxSh, 'utf8')
  chmodSync(path.join(releaseDir, 'ЗАПУСК macOS.command'), 0o755)
  chmodSync(path.join(releaseDir, 'запуск Linux.sh'), 0o755)

  const readme = `НЕЙРОПОРТРЕТ — полная переносная версия ${pkg.version}
====================================================

Внутри уже есть:
  • НейроПортрет (интерфейс)
  • Ollama AI (движок нейросети)
  • Модель ${DEFAULT_MODEL} (~2 ГБ)
  • Node.js для всех ОС

Ничего устанавливать не нужно. Интернет не нужен.

ЗАПУСК (один двойной клик):
  Windows  →  ЗАПУСК Windows.bat
  macOS    →  ЗАПУСК macOS.command  (ПКМ → Открыть, если macOS блокирует)
  Linux    →  запуск Linux.sh

Браузер откроется: http://127.0.0.1:${PORT}
AI-режим включён автоматически.

Первый запуск может занять 30–60 сек (загрузка модели в память).
Рекомендуется RAM: 8 ГБ и больше.

Остановка: закройте окно терминала / командной строки.

Папки:
  app/           — интерфейс НейроПортрет
  ollama/        — Ollama для Win / macOS / Linux
  ollama-data/   — модель ${DEFAULT_MODEL}
  runtime/       — Node.js

Размер сборки: ~5–6 ГБ (из-за AI для трёх ОС).
Передавайте целиком на флешке или через облако.
`
  writeFileSync(path.join(releaseDir, 'КАК ЗАПУСТИТЬ.txt'), readme, 'utf8')
}

async function createZip() {
  const zipPath = path.join(rootDir, 'release', `${releaseName}.zip`)
  rmSync(zipPath, { force: true })

  log('zip', 'Архивирование (без сжатия, может занять несколько минут)...')
  const zipResult = spawnSync('zip', ['-rq0', zipPath, releaseName], {
    cwd: path.join(rootDir, 'release'),
    stdio: 'inherit',
  })

  if (zipResult.status !== 0) {
    log('zip', 'zip не найден — папка release готова без архива')
    return null
  }
  return zipPath
}

async function main() {
  log('build', 'Сборка фронтенда...')
  run('npm', ['run', 'build'])

  log('clean', releaseDir)
  rmSync(releaseDir, { recursive: true, force: true })
  mkdirSync(appDir, { recursive: true })
  mkdirSync(runtimeDir, { recursive: true })
  mkdirSync(ollamaDir, { recursive: true })
  mkdirSync(ollamaDataDir, { recursive: true })

  cpSync(path.join(rootDir, 'dist'), path.join(appDir, 'dist'), { recursive: true })
  cpSync(path.join(rootDir, 'server'), path.join(appDir, 'server'), { recursive: true })

  writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify({
      name: 'neuro-portrait',
      version: pkg.version,
      private: true,
      type: 'module',
      dependencies: { express: pkg.dependencies.express },
    }, null, 2),
  )

  log('deps', 'Установка express...')
  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: appDir })

  const cacheDir = path.join(rootDir, 'release', '.cache')
  mkdirSync(cacheDir, { recursive: true })

  log('node', 'Node.js для Win / macOS / Linux...')
  for (const runtime of NODE_RUNTIMES) {
    await ensureNodeRuntime(runtime, cacheDir)
  }

  log('ollama', 'Ollama + библиотеки для Win / macOS / Linux (~4 ГБ)...')
  for (const runtime of OLLAMA_RUNTIMES) {
    await ensureOllamaRuntime(runtime, cacheDir)
  }

  await bundleModels()
  writeLaunchers()

  const totalSize = dirSize(releaseDir)
  const zipPath = await createZip()

  console.log('')
  console.log('═'.repeat(56))
  console.log('  Готово! НейроПортрет + Ollama + модель')
  console.log('═'.repeat(56))
  console.log(`  Папка:  ${releaseDir}`)
  console.log(`  Размер: ${formatSize(totalSize)}`)
  if (zipPath) console.log(`  Архив:  ${zipPath} (${formatSize(statSync(zipPath).size)})`)
  console.log('')
  console.log('  Ollama и llama3.2 внутри — получателю ничего ставить не нужно.')
  console.log('═'.repeat(56))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})