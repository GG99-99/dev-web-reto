import express, { type Request, type Response, type NextFunction, type Express } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Rutas de la API
// import apiRouter from './routes/index.js' // ajusta según tu estructura

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

// ==========================================
// 2. RUTAS DE LA API
// ==========================================
// app.use('/api', apiRouter)

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
            ok: false,
            error: {
                message: `Ruta no encontrada: ${req.path}`,
                statusCode: 404,
            },
        })
    }

    res.sendFile(path.join(frontendDistPath, 'index.html'))
})

// ==========================================
// 5. MANEJO DE ERRORES GLOBAL
// ==========================================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack)
    res.status(500).json({
        ok: false,
        error: {
            message: 'Error interno del servidor',
            statusCode: 500,
        },
    })
})

export default app