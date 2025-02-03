import { defineStore } from 'pinia'
import { ref } from 'vue'
import useSupabase from 'boot/supabase'
import { pinia } from 'boot/pinia'

const { supabase } = useSupabase()

export const useProfileStore = defineStore(
  'profile',
  () => {
    const loading = ref(false)
    const profile = ref(null)
    const error = ref(null)
    let currentFetch = null // 현재 진행 중인 fetch Promise를 추적

    async function fetchProfile(userId) {
      console.log('[ProfileStore] Starting to fetch profile...', {
        userId,
        loading: loading.value,
        hasPendingFetch: !!currentFetch,
      })

      // 이미 진행 중인 요청이 있다면 그 결과를 기다림
      if (currentFetch) {
        console.log('[ProfileStore] Waiting for existing fetch to complete...')
        const result = await currentFetch
        return result
      }

      loading.value = true
      error.value = null

      try {
        currentFetch = (async () => {
          try {
            console.log('[ProfileStore] Fetching profile data from Supabase...')
            const { data, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            if (profileError) {
              console.error('[ProfileStore] Error fetching profile:', profileError)
              throw profileError
            }

            console.log('[ProfileStore] Profile data received:', data)
            await Promise.resolve() // 상태 업데이트를 다음 tick으로 미룸
            profile.value = data
            return data
          } catch (err) {
            console.error('[ProfileStore] Error in fetchProfile:', err)
            error.value = err.message
            throw err
          }
        })()

        const result = await currentFetch
        return result
      } finally {
        loading.value = false
        currentFetch = null
        console.log('[ProfileStore] Profile fetch completed. States reset.')
      }
    }

    function clearProfile() {
      console.log('[ProfileStore] Clearing profile data')
      profile.value = null
      error.value = null
      loading.value = false
    }

    async function updateProfile({ fullName, username, bio, avatarUrl }) {
      try {
        loading.value = true
        const { data, error: err } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            username,
            bio,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.value.id)
          .select()
          .single()

        if (err) throw err
        profile.value = data
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    async function uploadAvatar(file) {
      try {
        loading.value = true
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${profile.value.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(filePath)

        await updateProfile({
          ...profile.value,
          avatarUrl: publicUrl,
        })
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    return {
      loading,
      profile,
      error,
      fetchProfile,
      clearProfile,
      updateProfile,
      uploadAvatar,
    }
  },
  {
    persist: {
      paths: ['profile'],
    },
    store: pinia,
  },
)
