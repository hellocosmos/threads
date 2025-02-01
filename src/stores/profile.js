import { defineStore } from 'pinia'
import { ref } from 'vue'
import useSupabase from 'boot/supabase'
import { pinia } from 'boot/pinia'

export const useProfileStore = defineStore(
  'profile',
  () => {
    const { supabase } = useSupabase()
    const profile = ref(null)
    const loading = ref(false)
    const error = ref(null)

    async function fetchProfile(userId) {
      try {
        loading.value = true
        const { data, error: err } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, bio')
          .eq('id', userId)
          .maybeSingle()

        if (err) throw err
        profile.value = data
      } catch (err) {
        error.value = err.message
        console.error('Error fetching profile:', err)
      } finally {
        loading.value = false
      }
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
      profile,
      loading,
      error,
      fetchProfile,
      updateProfile,
      uploadAvatar,
    }
  },
  { store: pinia },
)
