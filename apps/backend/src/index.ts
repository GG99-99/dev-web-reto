// apps/backend/src/index.ts
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 4 niveles arriba: src -> backend -> apps -> raíz del monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const { default: app } = await import('./app.js')

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`)
  console.log(`   API base: http://localhost:${PORT}/api/v1`)
})
