import { defineStore } from 'pinia'
import { ref } from 'vue'
import useSupabase from 'boot/supabase'
import pinia from './index' // default import 사용

// store를 직접 export
export const usePostsStore = defineStore(
  'posts',
  () => {
    const { supabase } = useSupabase()
    const posts = ref([])
    const loading = ref(false)
    const error = ref(null)

    async function fetchPosts() {
      try {
        loading.value = true

        // 현재 로그인한 사용자 정보 가져오기
        const {
          data: { user },
        } = await supabase.auth.getUser()

        // 먼저 posts 데이터를 가져옵니다
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })

        if (postsError) throw postsError

        // 각 post의 user_id를 사용하여 profiles 데이터와 likes 데이터를 가져옵니다
        const postsWithProfilesAndLikes = await Promise.all(
          postsData.map(async (post) => {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('username, avatar_url, full_name')
              .eq('id', post.user_id)
              .single()

            if (profileError) throw profileError

            // 현재 사용자의 좋아요 상태 확인
            const { data: likeData, error: likeError } = await supabase
              .from('likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', user.id)
              .maybeSingle()

            if (likeError) {
              console.error('좋아요 상태 확인 오류:', likeError)
              throw likeError
            }

            return {
              ...post,
              profiles: profileData,
              liked: !!likeData,
              isLikeLoading: false,
            }
          }),
        )

        // 각 post의 카운트 정보도 가져옵니다
        const postsWithAll = await Promise.all(
          postsWithProfilesAndLikes.map(async (post) => {
            const counts = await fetchPostCounts(post.id)
            return {
              ...post,
              commentCount: counts.commentCount,
              likeCount: counts.likeCount,
            }
          }),
        )

        posts.value = postsWithAll
      } catch (err) {
        error.value = err.message
        console.error('Error fetching posts:', err)
      } finally {
        loading.value = false
      }
    }

    async function createPost({ content, imageFile }) {
      try {
        loading.value = true
        let imageUrl = null

        // 이미지가 있는 경우 업로드
        if (imageFile) {
          const fileExt = imageFile.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `${Date.now()}_${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('post-images')
            .upload(filePath, imageFile)

          if (uploadError) throw uploadError

          const {
            data: { publicUrl },
          } = supabase.storage.from('post-images').getPublicUrl(filePath)

          imageUrl = publicUrl
        }

        // 포스트 생성
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const { data, error: err } = await supabase
          .from('posts')
          .insert({
            content,
            image_url: imageUrl,
            user_id: user.id,
          })
          .select()
          .single()

        if (err) throw err
        return data
      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        loading.value = false
      }
    }

    async function toggleLike(postId) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error('로그인이 필요합니다.')

        // 현재 게시물의 인덱스 찾기
        const postIndex = posts.value.findIndex((p) => p.id === postId)
        if (postIndex === -1) throw new Error('게시물을 찾을 수 없습니다.')

        // 현재 게시물의 복사본 생성
        const post = { ...posts.value[postIndex] }

        // 현재 사용자의 좋아요 상태 확인
        const { data: existingLike, error: likeError } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (likeError) throw likeError

        if (existingLike) {
          // 좋아요가 이미 있으면 삭제
          const { error: deleteError } = await supabase
            .from('likes')
            .delete()
            .eq('id', existingLike.id)

          if (deleteError) throw deleteError

          // 상태 업데이트
          post.liked = false
          post.likeCount = Math.max(0, (post.likeCount || 0) - 1)
        } else {
          // 좋아요가 없으면 추가
          const { error: insertError } = await supabase.from('likes').insert({
            post_id: postId,
            user_id: user.id,
          })

          if (insertError) throw insertError

          // 상태 업데이트
          post.liked = true
          post.likeCount = (post.likeCount || 0) + 1
        }

        // 로딩 상태 해제
        post.isLikeLoading = false

        // 상태 업데이트
        posts.value[postIndex] = post

        return { success: true }
      } catch (err) {
        console.error('좋아요 토글 오류:', err)
        throw err
      }
    }

    async function fetchComments(postId) {
      try {
        loading.value = true
        // 먼저 comments를 가져옵니다
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .is('parent_id', null) // 최상위 댓글만 가져옴
          .order('created_at', { ascending: true })

        if (commentsError) throw commentsError

        // 각 댓글의 프로필과 대댓글을 가져옵니다
        const commentsWithReplies = await Promise.all(
          commentsData.map(async (comment) => {
            // 프로필 정보 가져오기
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('username, avatar_url, full_name')
              .eq('id', comment.user_id)
              .single()

            if (profileError) throw profileError

            // 대댓글 가져오기
            const { data: replies, error: repliesError } = await supabase
              .from('comments')
              .select('*')
              .eq('parent_id', comment.id)
              .order('created_at', { ascending: true })

            if (repliesError) throw repliesError

            // 대댓글의 프로필 정보 가져오기
            const repliesWithProfiles = await Promise.all(
              (replies || []).map(async (reply) => {
                const { data: replyProfile, error: replyProfileError } = await supabase
                  .from('profiles')
                  .select('username, avatar_url, full_name')
                  .eq('id', reply.user_id)
                  .single()

                if (replyProfileError) throw replyProfileError

                return {
                  ...reply,
                  profiles: replyProfile,
                }
              }),
            )

            return {
              ...comment,
              profiles: profileData,
              replies: repliesWithProfiles,
            }
          }),
        )

        return commentsWithReplies
      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        loading.value = false
      }
    }

    async function addComment(postId, content) {
      try {
        loading.value = true
        const {
          data: { user },
        } = await supabase.auth.getUser()

        // 댓글 추가
        const { data: commentData, error: commentError } = await supabase
          .from('comments')
          .insert({
            post_id: postId,
            user_id: user.id,
            content,
          })
          .select('*')
          .single()

        if (commentError) throw commentError

        // 프로필 정보 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url, full_name')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError

        // 댓글과 프로필 정보 합치기
        return {
          ...commentData,
          profiles: profileData,
        }
      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        loading.value = false
      }
    }

    async function fetchPostCounts(postId) {
      try {
        // 댓글 수 가져오기
        const { count: commentCount, error: commentError } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)

        if (commentError) throw commentError

        // 좋아요 수 가져오기
        const { count: likeCount, error: likeError } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)

        if (likeError) throw likeError

        return {
          commentCount,
          likeCount,
        }
      } catch (err) {
        console.error('Error fetching counts:', err)
        return { commentCount: 0, likeCount: 0 }
      }
    }

    async function fetchPost(postId) {
      try {
        loading.value = true
        const {
          data: { user },
        } = await supabase.auth.getUser()

        // 게시물 데이터 가져오기
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('id', postId)
          .single()

        if (postError) throw postError

        // 프로필 데이터 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url, full_name')
          .eq('id', postData.user_id)
          .single()

        if (profileError) throw profileError

        // 좋아요 상태 확인
        const { data: likeData, error: likeError } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (likeError) throw likeError

        // 카운트 정보 가져오기
        const counts = await fetchPostCounts(postId)

        const post = {
          ...postData,
          profiles: profileData,
          liked: !!likeData,
          isLikeLoading: false,
          ...counts,
        }

        return { data: post }
      } catch (err) {
        console.error('Error fetching post:', err)
        return { error: err }
      } finally {
        loading.value = false
      }
    }

    // 대댓글 작성 함수 추가
    async function addReply(postId, parentId, content) {
      try {
        loading.value = true
        const {
          data: { user },
        } = await supabase.auth.getUser()

        // 대댓글 추가
        const { data: commentData, error: commentError } = await supabase
          .from('comments')
          .insert({
            post_id: postId,
            user_id: user.id,
            content,
            parent_id: parentId,
          })
          .select('*')
          .single()

        if (commentError) throw commentError

        // 프로필 정보 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url, full_name')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError

        // 댓글과 프로필 정보 합치기
        const replyWithProfile = {
          ...commentData,
          profiles: profileData,
        }

        // 해당 게시물의 댓글 카운트 업데이트
        const postIndex = posts.value.findIndex((p) => p.id === postId)
        if (postIndex !== -1) {
          posts.value[postIndex] = {
            ...posts.value[postIndex],
            commentCount: (posts.value[postIndex].commentCount || 0) + 1,
          }
        }

        return replyWithProfile
      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        loading.value = false
      }
    }

    // 모든 함수들을 return
    return {
      posts,
      loading,
      error,
      fetchPosts,
      createPost,
      toggleLike,
      fetchComments,
      addComment,
      fetchPostCounts,
      fetchPost,
      addReply,
    }
  },
  { store: pinia }, // getPinia() 대신 pinia 직접 사용
)
