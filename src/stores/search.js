import { defineStore } from 'pinia'
import { ref } from 'vue'
import useSupabase from 'boot/supabase'
import { useUserStore } from 'stores/user'

const { supabase } = useSupabase()

export const useSearchStore = defineStore(
  'search',
  () => {
    const loading = ref(false)
    const posts = ref([])
    const users = ref([])
    const userStore = useUserStore()
    let currentSearch = null

    function clearResults() {
      posts.value = []
      users.value = []
      loading.value = false
    }

    async function searchPosts(query) {
      console.log('[SearchStore] Starting posts search...', {
        query,
        loading: loading.value,
        hasPendingSearch: !!currentSearch,
      })

      if (!query.trim()) return []

      if (currentSearch) {
        console.log('[SearchStore] Waiting for existing search to complete...')
        const result = await currentSearch
        return result
      }

      loading.value = true

      try {
        currentSearch = (async () => {
          try {
            const { data: postsData, error } = await supabase
              .from('posts')
              .select('*')
              .ilike('content', `%${query}%`)
              .order('created_at', { ascending: false })

            if (error) throw error

            const postsWithCounts = await Promise.all(
              (postsData || []).map(async (post) => {
                const [{ data: profileData }, likesData, commentsData, likeStatus] =
                  await Promise.all([
                    supabase
                      .from('profiles')
                      .select('id, username, full_name, avatar_url')
                      .eq('id', post.user_id)
                      .single(),
                    supabase
                      .from('likes')
                      .select('*', { count: 'exact', head: true })
                      .eq('post_id', post.id),
                    supabase
                      .from('comments')
                      .select('*', { count: 'exact', head: true })
                      .eq('post_id', post.id),
                    supabase
                      .from('likes')
                      .select('id')
                      .eq('post_id', post.id)
                      .eq('user_id', userStore.user?.id)
                      .maybeSingle(),
                  ])

                return {
                  ...post,
                  profiles: profileData,
                  likeCount: likesData.count || 0,
                  commentCount: commentsData.count || 0,
                  liked: !!likeStatus.data,
                }
              }),
            )

            await Promise.resolve()
            posts.value = postsWithCounts
            return postsWithCounts
          } catch (err) {
            console.error('[SearchStore] Error:', err)
            await Promise.resolve()
            posts.value = []
            throw err
          }
        })()

        const result = await currentSearch
        return result
      } finally {
        loading.value = false
        currentSearch = null
        console.log('[SearchStore] Search completed. States reset.')
      }
    }

    async function searchUsers(query) {
      if (!query.trim()) return []

      loading.value = true
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
          .order('username')

        if (error) throw error

        await Promise.resolve()
        users.value = data || []
        return data || []
      } catch (err) {
        console.error('[SearchStore] Error:', err)
        await Promise.resolve()
        users.value = []
        throw err
      } finally {
        loading.value = false
      }
    }

    return {
      loading,
      posts,
      users,
      searchPosts,
      searchUsers,
      clearResults,
    }
  },
  {
    persist: {
      paths: ['posts', 'users'],
    },
  },
)
