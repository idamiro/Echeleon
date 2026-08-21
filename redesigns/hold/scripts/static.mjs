import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

const DEV_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="HOLD — a Vulcet experiment for cooling purchase decisions with independent utility, need, value, and impulse signals."
    />
    <title>HOLD · Vulcet experiment</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`

export async function ensureDevIndex() {
  await writeFile(path.join(root, 'index.html'), DEV_INDEX, 'utf8')
}

export async function publishStatic() {
  const built = await readFile(path.join(dist, 'index.html'), 'utf8')
  await writeFile(path.join(root, 'index.html'), built, 'utf8')

  const assetsOut = path.join(root, 'assets')
  await rm(assetsOut, { recursive: true, force: true })
  await mkdir(assetsOut, { recursive: true })
  await cp(path.join(dist, 'assets'), assetsOut, { recursive: true })

  // No _redirects — Workers static deploy rejects /* → index.html as an infinite loop.
  // Routing uses HashRouter instead.
}

const cmd = process.argv[2]
if (cmd === 'dev-index') await ensureDevIndex()
else if (cmd === 'publish') await publishStatic()
else {
  console.error('Usage: node scripts/static.mjs <dev-index|publish>')
  process.exit(1)
}
