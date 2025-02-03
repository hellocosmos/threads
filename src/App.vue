<template>
  <router-view />
</template>

<script setup>
import { onMounted, provide } from 'vue'
import { getPinia } from 'stores'
import { useRouter } from 'vue-router'
import useSupabase from 'boot/supabase'
import { useUserStore } from 'stores/user'
import { usePostsStore } from 'stores/posts'

// 필요한 인스턴스 초기화
getPinia()
const router = useRouter()
const { supabase } = useSupabase()
const userStore = useUserStore()
const postsStore = usePostsStore()

// 전역 상태 초기화 함수
async function initializeApp() {
  try {
    const currentUser = await userStore.init()

    // 로그인 상태가 아니고 현재 auth 경로가 아니면 로그인 페이지로 리다이렉트
    if (!currentUser && !router.currentRoute.value.path.startsWith('/auth')) {
      router.push('/auth/login')
    } else if (currentUser) {
      // 로그인 상태면 게시물 데이터 로드
      await postsStore.fetchPosts()
    }
  } catch (err) {
    console.error('Error initializing app:', err)
    router.push('/auth/login')
  }
}

// 앱 초기화 및 상태 변경 감지
onMounted(async () => {
  await initializeApp()

  // 인증 상태 변경 감지
  supabase.auth.onAuthStateChange(async (event, session) => {
    await userStore.handleAuthChange(session)

    if (event === 'SIGNED_OUT') {
      router.push('/auth/login')
    } else if (event === 'SIGNED_IN') {
      await postsStore.fetchPosts()
      router.push('/')
    }
  })

  // 페이지 가시성 변경 이벤트 리스너 추가
  document.addEventListener('visibilitychange', async () => {
    console.log('[Visibility Change]', {
      state: document.visibilityState,
      isAuthenticated: userStore.isAuthenticated,
      currentRoute: router.currentRoute.value.path,
    })

    if (document.visibilityState === 'visible' && userStore.isAuthenticated) {
      const currentRoute = router.currentRoute.value

      // 현재 라우트에 따라 데이터 새로고침
      if (currentRoute.path === '/') {
        console.log('[Home] Refreshing posts data...')
        await postsStore.fetchPosts()
        console.log('[Home] Posts data refreshed')
      } else if (currentRoute.path.startsWith('/profile')) {
        console.log('[Profile] Starting profile refresh...')
        try {
          const userId = currentRoute.params.id || userStore.user?.id
          console.log('[Profile] Fetching profile for user:', userId)

          if (!userId) {
            console.warn('[Profile] No user ID available for profile fetch')
            return
          }

          await userStore.fetchProfile(userId)
          console.log('[Profile] Profile data successfully refreshed')
        } catch (err) {
          console.error('[Profile] Error refreshing profile:', err)
        }
      } else if (currentRoute.path === '/activity') {
        console.log('[Activity] Refreshing data...')
        // store를 직접 import하여 사용
        const { useActivityStore } = await import('stores/activity')
        const activityStore = useActivityStore()
        await activityStore.fetchTrendingPosts()
        console.log('[Activity] Data refreshed')
      } else if (currentRoute.path === '/search') {
        console.log('[Search] Refreshing data...')
        // 검색 페이지는 사용자 액션이 필요하므로 새로고침하지 않음
        console.log('[Search] Skipping auto-refresh as it requires user input')
      }
    }
  })
})

// 전역 상태 provide
provide('initializeApp', initializeApp)
</script>
