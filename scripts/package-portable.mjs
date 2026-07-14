#!/usr/bin/env node
/**
 * Собирает переносимый архив НейроПортрет:
 * - встроенный Node.js для Win / macOS / Linux
 * - локальный сервер + статика
 * - запуск одним двойным кликом
 */
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const NODE_VERSION = '20.19.0'
const PORT = '8765'

const RUNTIMES = [
  { id: 'win', archive: `node-v${NODE_VERSION}-win-x64.zip`, nodePath: 'node.exe', extract: 'zip' },
  { id: 'mac-arm64', archive: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`, nodePath: 'bin/node', extract: 'tar' },
  { id: 'mac-x64', archive: `node-v${NODE_VERSION}-darwin-x64.tar.gz`, nodePath: 'bin/node', extract: 'tar' },
  { id: 'linux', archive: `node-v${NODE_VERSION}-linux-x64.tar.gz`, nodePath: 'bin/node', extract: 'tar' },
]

const releaseName = `NeuroPortrait-${pkg.version}`
const releaseDir = path.join(rootDir, 'release', releaseName)
const appDir = path.join(releaseDir, 'app')
const runtimeDir = path.join(releaseDir, 'runtime')

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

async function download(url, dest) {
  if (existsSync(dest)) {
    log('cache', `Уже скачан: ${path.basename(dest)}`)
    return
  }
  log('download', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось скачать ${url}: ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function extractZip(archivePath, destDir) {
  const unzip = spawnSync('unzip', ['-qo', archivePath, '-d', destDir], { stdio: 'inherit' })
  if (unzip.status !== 0) {
    throw new Error(`unzip failed for ${archivePath}`)
  }
}

async function extractTarGz(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true })
  const tar = spawnSync('tar', ['-xzf', archivePath, '-C', destDir], { stdio: 'inherit' })
  if (tar.status !== 0) {
    throw new Error(`tar failed for ${archivePath}`)
  }
}

async function ensureRuntime(runtime, cacheDir) {
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${runtime.archive}`
  const archivePath = path.join(cacheDir, runtime.archive)
  const extractRoot = path.join(runtimeDir, runtime.id)
  const nodeDest = path.join(extractRoot, runtime.nodePath)

  if (existsSync(nodeDest)) {
    log('runtime', `${runtime.id} — готов`)
    return nodeDest
  }

  await download(url, archivePath)
  mkdirSync(extractRoot, { recursive: true })

  const tmpExtract = path.join(cacheDir, `extract-${runtime.id}`)
  rmSync(tmpExtract, { recursive: true, force: true })
  mkdirSync(tmpExtract, { recursive: true })

  if (runtime.extract === 'zip') {
    await extractZip(archivePath, tmpExtract)
  } else {
    await extractTarGz(archivePath, tmpExtract)
  }

  const extractedFolder = path.join(
    tmpExtract,
    runtime.archive.replace(/\.tar\.gz$/, '').replace(/\.zip$/, ''),
  )
  const nodeSrc = path.join(extractedFolder, runtime.nodePath)
  if (!existsSync(nodeSrc)) {
    throw new Error(`Node binary not found: ${nodeSrc}`)
  }

  mkdirSync(path.dirname(nodeDest), { recursive: true })
  copyFileSync(nodeSrc, nodeDest)
  if (runtime.extract !== 'zip') {
    chmodSync(nodeDest, 0o755)
  }

  rmSync(tmpExtract, { recursive: true, force: true })
  log('runtime', `${runtime.id} — установлен`)
  return nodeDest
}

function writeLaunchers() {
  const winBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=${PORT}
set OPEN_BROWSER=1
set OLLAMA_HOST=http://127.0.0.1:11434
echo.
echo  НейроПортрет — запуск...
echo  Закройте это окно, чтобы остановить сервер.
echo.
cd app
"..\\runtime\\win\\node.exe" server\\index.js
pause
`

  const macCommand = `#!/bin/bash
cd "$(dirname "$0")"
export PORT=${PORT}
export OPEN_BROWSER=1
export OLLAMA_HOST=http://127.0.0.1:11434

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  NODE="../runtime/mac-arm64/bin/node"
else
  NODE="../runtime/mac-x64/bin/node"
fi

if [ ! -f "$NODE" ]; then
  echo "Node runtime не найден: $NODE"
  read -r -p "Нажмите Enter..."
  exit 1
fi

cd app
echo ""
echo "  НейроПортрет — запуск..."
echo "  Закройте это окно, чтобы остановить сервер."
echo ""
"$NODE" server/index.js
`

  const linuxSh = `#!/bin/bash
cd "$(dirname "$0")"
export PORT=${PORT}
export OPEN_BROWSER=1
export OLLAMA_HOST=http://127.0.0.1:11434
NODE="../runtime/linux/bin/node"

if [ ! -f "$NODE" ]; then
  echo "Node runtime не найден: $NODE"
  read -r -p "Нажмите Enter..."
  exit 1
fi

cd app
echo ""
echo "  НейроПортрет — запуск..."
echo "  Закройте это окно, чтобы остановить сервер."
echo ""
"$NODE" server/index.js
`

  writeFileSync(path.join(releaseDir, 'ЗАПУСК Windows.bat'), winBat, 'utf8')
  writeFileSync(path.join(releaseDir, 'ЗАПУСК macOS.command'), macCommand, 'utf8')
  writeFileSync(path.join(releaseDir, 'запуск Linux.sh'), linuxSh, 'utf8')
  chmodSync(path.join(releaseDir, 'ЗАПУСК macOS.command'), 0o755)
  chmodSync(path.join(releaseDir, 'запуск Linux.sh'), 0o755)

  const readme = `НЕЙРОПОРТРЕТ — переносная версия ${pkg.version}
============================================

Как запустить (один двойной клик):

  Windows  →  ЗАПУСК Windows.bat
  macOS    →  ЗАПУСК macOS.command
             (если macOS блокирует: ПКМ → Открыть)
  Linux    →  запуск Linux.sh

После запуска откроется браузер: http://127.0.0.1:${PORT}

Что внутри:
  • Работает без интернета (эвристический режим)
  • Node.js уже внутри — ничего устанавливать не нужно
  • Можно копировать на флешку и передавать целиком

AI-режим (опционально):
  Установите Ollama с https://ollama.com
  Запустите Ollama, затем НейроПортрет — AI включится автоматически.

Остановка:
  Закройте чёрное окно терминала / командной строки.

Папки:
  app/      — программа
  runtime/  — встроенный Node.js для всех ОС
`
  writeFileSync(path.join(releaseDir, 'КАК ЗАПУСТИТЬ.txt'), readme, 'utf8')
}

async function createZip() {
  const zipPath = path.join(rootDir, 'release', `${releaseName}.zip`)
  rmSync(zipPath, { force: true })

  const zipResult = spawnSync('zip', ['-rq', zipPath, releaseName], {
    cwd: path.join(rootDir, 'release'),
    stdio: 'inherit',
  })

  if (zipResult.status !== 0) {
    log('zip', 'zip не найден — архив .zip не создан, папка release готова')
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

  cpSync(path.join(rootDir, 'dist'), path.join(appDir, 'dist'), { recursive: true })
  cpSync(path.join(rootDir, 'server'), path.join(appDir, 'server'), { recursive: true })

  const prodPkg = {
    name: 'neuro-portrait',
    version: pkg.version,
    private: true,
    type: 'module',
    dependencies: {
      express: pkg.dependencies.express,
    },
  }
  writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(prodPkg, null, 2))

  log('deps', 'Установка express в portable-пакет...')
  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: appDir })

  const cacheDir = path.join(rootDir, 'release', '.cache')
  mkdirSync(cacheDir, { recursive: true })

  log('runtimes', 'Скачивание Node.js для Win / macOS / Linux...')
  for (const runtime of RUNTIMES) {
    await ensureRuntime(runtime, cacheDir)
  }

  writeLaunchers()

  const zipPath = await createZip()

  console.log('')
  console.log('═'.repeat(52))
  console.log('  Готово! Переносная версия НейроПортрет')
  console.log('═'.repeat(52))
  console.log(`  Папка:  ${releaseDir}`)
  if (zipPath) console.log(`  Архив:  ${zipPath}`)
  console.log('')
  console.log('  Передайте zip или всю папку — получатель распаковывает')
  console.log('  и запускает файл для своей операционной системы.')
  console.log('═'.repeat(52))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})