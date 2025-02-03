import { defineStore } from 'pinia'
import { ref } from 'vue'
import useSupabase from 'boot/supabase'
import { useUserStore } from 'stores/user'

const { supabase } = useSupabase()

export const useActivityStore = defineStore(
  'activity',
  () => {
    const loading = ref(false)
    const trendingPosts = ref([])
    const users = ref([])
    const userStore = useUserStore()
    let currentFetch = null

    async function fetchTrendingPosts() {
      console.log('[ActivityStore] Starting to fetch trending posts...', {
        loading: loading.value,
        hasPendingFetch: !!currentFetch,
      })

      if (currentFetch) {
        console.log('[ActivityStore] Waiting for existing fetch to complete...')
        const result = await currentFetch
        return result
      }

      loading.value = true

      try {
        currentFetch = (async () => {
          try {
            console.log('[ActivityStore] Fetching posts from Supabase...')
            const { data: posts, error } = await supabase
              .from('posts')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100)

            if (error) throw error

            if (!posts?.length) {
              await Promise.resolve()
              trendingPosts.value = []
              return []
            }

            const postsWithCounts = await Promise.all(
              posts.map(async (post) => {
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

            const sortedPosts = postsWithCounts
              .sort((a, b) => b.likeCount - a.likeCount)
              .slice(0, 20)

            await Promise.resolve()
            trendingPosts.value = sortedPosts
            return sortedPosts
          } catch (err) {
            console.error('[ActivityStore] Error:', err)
            await Promise.resolve()
            trendingPosts.value = []
            throw err
          }
        })()

        const result = await currentFetch
        return result
      } finally {
        loading.value = false
        currentFetch = null
        console.log('[ActivityStore] Fetch completed. States reset.')
      }
    }

    return {
      loading,
      trendingPosts,
      users,
      fetchTrendingPosts,
    }
  },
  {
    persist: {
      paths: ['trendingPosts'],
    },
  },
)
