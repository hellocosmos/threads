import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// ES 모듈에서 __dirname 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()  // .env 파일 로드
const app = express()
const port = process.env.PORT || 3000

// 정적 파일 제공
app.use(express.static(join(__dirname, 'dist/spa')))

// SPA 라우팅
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist/spa/index.html'))
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
