<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { getPinia } from 'stores'
import { useRouter } from 'vue-router'
import useSupabase from 'boot/supabase'
import { useUserStore } from 'stores/user'

// 필요한 인스턴스 초기화
getPinia()
const router = useRouter()
const { supabase } = useSupabase()
const userStore = useUserStore()

// 초기 인증 상태 체크
onMounted(async () => {
  try {
    const currentUser = await userStore.init()

    // 로그인 상태가 아니고 현재 auth 경로가 아니면 로그인 페이지로 리다이렉트
    if (!currentUser && !router.currentRoute.value.path.startsWith('/auth')) {
      router.push('/auth/login')
    }

    // 인증 상태 변경 감지
    supabase.auth.onAuthStateChange(async (event, session) => {
      await userStore.handleAuthChange(session)

      // 로그아웃 시 로그인 페이지로 리다이렉트
      if (event === 'SIGNED_OUT') {
        router.push('/auth/login')
      }
    })
  } catch (err) {
    console.error('Error initializing app:', err)
    router.push('/auth/login')
  }
})
</script>
