import { createPinia } from 'pinia'

// 싱글톤 패턴으로 pinia 인스턴스 관리
let pinia = null

export function getPinia() {
  if (!pinia) {
    pinia = createPinia()
  }
  return pinia
}

// 전역 Pinia 인스턴스 생성
const globalPinia = getPinia()

// default export로 globalPinia 내보내기
export default globalPinia

// named exports
export { pinia }

// store들은 여기서 export하지 않음
