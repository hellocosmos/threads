import { boot } from 'quasar/wrappers'

export default boot(({ app }) => {
  // 전역 터치 이벤트 설정
  app.config.compilerOptions.isCustomElement = (tag) => {
    return tag.startsWith('touch-')
  }

  // passive 이벤트 리스너 설정
  app.config.globalProperties.$touch = {
    passive: true,
  }
})
