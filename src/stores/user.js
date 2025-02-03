import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import useSupabase from 'boot/supabase'
import { getPinia } from './index'

export const useUserStore = defineStore(
  'user',
  () => {
    const { supabase } = useSupabase()
    const user = ref(null)
    const profile = ref(null)
    const loading = ref(false)
    const error = ref(null)
    const followers = ref([])
    const following = ref([])

    // 스토어 초기화 시 현재 로그인된 사용자 정보 가져오기
    async function init() {
      try {
        // 세션 정보 가져오기
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          user.value = session.user

          // 프로필 정보 가져오기
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profileError) {
            console.error('Error fetching profile:', profileError)
          } else if (profileData) {
            profile.value = profileData
          }

          // 세션 갱신 설정
          supabase.auth.onAuthStateChange((event, newSession) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              user.value = newSession?.user || null
            }
          })

          return session.user
        } else {
          user.value = null
          profile.value = null
          return null
        }
      } catch (err) {
        console.error('Error initializing user store:', err)
        user.value = null
        profile.value = null
        return null
      }
    }

    // 인증 상태 변경 시 호출할 함수
    async function handleAuthChange(session) {
      try {
        if (session?.user) {
          user.value = session.user
          await fetchProfile()
        } else {
          user.value = null
          profile.value = null
        }
      } catch (err) {
        console.error('Error handling auth change:', err)
      }
    }

    // 컴포넌트에서 사용할 computed 속성 추가
    const isAuthenticated = computed(() => !!user.value)

    async function fetchProfile(userId = null) {
      try {
        // userId가 없으면 현재 로그인한 사용자의 프로필을 가져옴
        if (!userId) {
          const {
            data: { user: currentUser },
          } = await supabase.auth.getUser()
          if (!currentUser) return null
          userId = currentUser.id
        }

        const { data, error: err } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, full_name, bio')
          .eq('id', userId)
          .single()

        if (err) throw err

        // 현재 로그인한 사용자의 프로필인 경우에만 store에 저장
        if (userId === user.value?.id) {
          profile.value = data
        }

        return data
      } catch (err) {
        error.value = err.message
        console.error('프로필 로드 오류:', err)
        return null
      }
    }

    async function login(email, password) {
      try {
        loading.value = true
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (err) throw err
        user.value = data.user
        await fetchProfile()
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    async function register(email, password, username) {
      try {
        loading.value = true
        console.log('Registering user...', { email, username })

        // 1. 회원가입 시도
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        })

        console.log('SignUp response:', authData, authError)

        if (authError) throw authError

        // 2. 이메일 확인 없이 바로 로그인 시도
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        console.log('SignIn response:', signInData, signInError)

        if (signInError) {
          // 이메일 확인이 필요한 경우에도 성공으로 처리
          if (signInError.message.includes('Email not confirmed')) {
            user.value = authData.user
            return true
          }
          throw signInError
        }

        user.value = signInData.user
        return true
      } catch (err) {
        console.error('Registration error:', err)
        // 이메일 확인 오류는 성공으로 처리
        if (err.message.includes('Email not confirmed')) {
          return true
        }
        error.value = err.message
        return false
      } finally {
        loading.value = false
      }
    }

    async function logout() {
      try {
        loading.value = true
        const { error: err } = await supabase.auth.signOut()
        if (err) throw err
        user.value = null
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    async function fetchFollowCounts(userId) {
      try {
        // userId가 없으면 early return
        if (!userId) {
          return { followersCount: 0, followingCount: 0 }
        }

        // 팔로워 수 가져오기
        const { count: followersCount, error: followersError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId)

        if (followersError) throw followersError

        // 팔로잉 수 가져오기
        const { count: followingCount, error: followingError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId)

        if (followingError) throw followingError

        return {
          followersCount,
          followingCount,
        }
      } catch (err) {
        console.error('Error fetching follow counts:', err)
        return { followersCount: 0, followingCount: 0 }
      }
    }

    async function isFollowing(targetUserId) {
      try {
        if (!targetUserId || !user.value?.id) {
          return false
        }

        const { data, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.value.id)
          .eq('following_id', targetUserId)
          .maybeSingle()

        if (error) {
          console.error('Error checking follow status:', error)
          return false
        }

        return !!data
      } catch (err) {
        console.error('Error checking follow status:', err)
        return false
      }
    }

    async function toggleFollow(targetUserId) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          throw new Error('로그인이 필요합니다.')
        }

        if (!targetUserId) {
          throw new Error('대상 사용자 정보가 없습니다.')
        }

        if (targetUserId === session.user.id) {
          throw new Error('자기 자신을 팔로우할 수 없습니다.')
        }

        user.value = session.user

        // 현재 팔로우 상태 확인
        const { data: followData, error: followCheckError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', session.user.id)
          .eq('following_id', targetUserId)
          .maybeSingle()

        if (followCheckError) {
          throw followCheckError
        }

        const isCurrentlyFollowing = !!followData

        if (isCurrentlyFollowing) {
          const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', session.user.id)
            .eq('following_id', targetUserId)

          if (error) throw error
        } else {
          const { error } = await supabase.from('follows').insert({
            follower_id: session.user.id,
            following_id: targetUserId,
          })

          if (error) throw error
        }

        return { success: true, isFollowing: !isCurrentlyFollowing }
      } catch (err) {
        console.error('Error toggling follow:', err)
        if (err.code === 'PGRST116') {
          throw new Error('팔로우 상태를 확인할 수 없습니다. 다시 시도해주세요.')
        }
        throw err
      }
    }

    return {
      user,
      profile,
      loading,
      error,
      followers,
      following,
      isAuthenticated,
      init,
      handleAuthChange,
      fetchProfile,
      login,
      register,
      logout,
      fetchFollowCounts,
      isFollowing,
      toggleFollow,
    }
  },
  { store: getPinia() },
  {
    persist: {
      paths: ['user', 'profile'],
    },
  },
)
