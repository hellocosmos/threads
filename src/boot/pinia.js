import { createPinia } from 'pinia'
import { boot } from 'quasar/wrappers'

// 전역 pinia 인스턴스 생성
const pinia = createPinia()

// Quasar boot 파일
export default boot(({ app }) => {
  // 이전에 설치된 pinia 제거
  if (app._pinia) {
    app._pinia = null
  }
  app.use(pinia)
})

// pinia 인스턴스 export
export { pinia }
