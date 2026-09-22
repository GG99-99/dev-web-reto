import express, { type Request, type Response, type Express } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import { apiRouter } from './api.router.js'
import { errorHandler } from './handlers/errorHandler.js'

dotenv.config()

// __dirname no existe nativamente en ESM, hay que reconstruirlo
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: Express = express()

// ==========================================
// 1. MIDDLEWARES GLOBALES
// ==========================================
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Archivos subidos vía POST /attachments (multer, almacenamiento local en disco)
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')))

// ==========================================
// 2. RUTAS DE LA API
// Base URL: /api/v1 (sección 0 de documentos/API_CONTRACTS.md)
// ==========================================
app.use('/api/v1', apiRouter)

// ==========================================
// 3. ARCHIVOS ESTÁTICOS (frontend)
// ==========================================
const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist')
app.use(express.static(frontendDistPath))

// ==========================================
// 4. CATCH-ALL para SPA (React, Vue, etc)
// Solo para rutas que NO son /api/*
// ==========================================
app.get('/*catchall', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            valid: false,
            error: {
                code: 'NOT_FOUND',
                message: `Route not found: ${req.path}`,
            },
        })
    }

    res.sendFile(path.join(frontendDistPath, 'index.html'))
})

// ==========================================
// 5. MANEJO DE ERRORES GLOBAL (siempre al final)
// ==========================================
app.use(errorHandler)

export default app
