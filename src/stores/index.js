import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

// 싱글톤 패턴으로 pinia 인스턴스 관리
let pinia = null

export function getPinia() {
  if (!pinia) {
    pinia = createPinia()
    // 상태 지속성 플러그인 추가
    pinia.use(
      createPersistedState({
        storage: localStorage,
        key: (prefix) => `threads_${prefix}`, // 스토어별 키 접두사 추가
      }),
    )
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
