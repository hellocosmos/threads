import { defineStore } from 'pinia'
import { ref } from 'vue'
import useSupabase from 'boot/supabase'
import { useUserStore } from 'stores/user'
// import pinia from './index' // default import 사용

// store를 직접 export
export const usePostsStore = defineStore(
  'posts',
  () => {
    const { supabase } = useSupabase()
    const posts = ref([])
    const loading = ref(false)
    const error = ref(null)
    const userStore = useUserStore()
    let currentFetch = null

    async function fetchPosts() {
      console.log('[PostsStore] Starting to fetch posts...', {
        loading: loading.value,
        hasPendingFetch: !!currentFetch,
      })

      if (currentFetch) {
        console.log('[PostsStore] Waiting for existing fetch to complete...')
        const result = await currentFetch
        return result
      }

      loading.value = true

      try {
        currentFetch = (async () => {
          try {
            console.log('[PostsStore] Fetching posts from Supabase...')
            const { data: postsData, error } = await supabase
              .from('posts')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(50)

            if (error) throw error

            if (!postsData?.length) {
              console.log('[PostsStore] No posts found')
              await Promise.resolve()
              posts.value = []
              return []
            }

            console.log('[PostsStore] Found posts:', postsData.length)
            console.log('[PostsStore] Fetching additional data for posts...')

            const postsWithCounts = await Promise.all(
              postsData.map(async (post) => {
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

            console.log('[PostsStore] Successfully processed all posts data')
            await Promise.resolve()
            posts.value = postsWithCounts
            return postsWithCounts
          } catch (err) {
            console.error('[PostsStore] Error in fetchPosts:', err)
            await Promise.resolve()
            posts.value = []
            throw err
          }
        })()

        const result = await currentFetch
        return result
      } finally {
        loading.value = false
        currentFetch = null
        console.log('[PostsStore] Posts fetch completed. States reset.')
      }
    }

    async function createPost({ content, imageFile }) {
      console.log('[PostsStore] Starting to create post...', {
        hasImage: !!imageFile,
      })
      loading.value = true

      try {
        let imageUrl = null

        // 이미지가 있는 경우 업로드
        if (imageFile) {
          console.log('[PostsStore] Uploading image...')
          const fileExt = imageFile.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `${Date.now()}_${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('post-images')
            .upload(filePath, imageFile)

          if (uploadError) {
            console.error('[PostsStore] Image upload error:', uploadError)
            throw uploadError
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from('post-images').getPublicUrl(filePath)

          imageUrl = publicUrl
          console.log('[PostsStore] Image uploaded successfully:', imageUrl)
        }

        // 포스트 생성
        console.log('[PostsStore] Creating post in database...')
        const { data: newPost, error } = await supabase
          .from('posts')
          .insert([
            {
              content,
              image_url: imageUrl,
              user_id: userStore.user.id,
            },
          ])
          .select()
          .single()

        if (error) {
          console.error('[PostsStore] Post creation error:', error)
          throw error
        }
        console.log('[PostsStore] Post created successfully:', newPost)

        // 새 게시물에 필요한 추가 데이터 가져오기
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', newPost.user_id)
          .single()

        const fullPost = {
          ...newPost,
          profiles: profileData,
          likeCount: 0,
          commentCount: 0,
          liked: false,
        }

        await Promise.resolve()
        posts.value = [fullPost, ...posts.value]
        console.log('[PostsStore] Post added to state')
        return fullPost
      } catch (err) {
        console.error('[PostsStore] Error creating post:', err)
        throw err
      } finally {
        loading.value = false
        console.log('[PostsStore] Create post completed')
      }
    }

    async function updatePost({ postId, content, imageFile, removeImage }) {
      console.log('[PostsStore] Starting to update post...', {
        postId,
        hasNewImage: !!imageFile,
        removeImage,
      })
      loading.value = true

      try {
        const postIndex = posts.value.findIndex((p) => p.id === postId)
        if (postIndex === -1) throw new Error('게시물을 찾을 수 없습니다.')

        let imageUrl = posts.value[postIndex].image_url

        // 이미지 처리
        if (removeImage) {
          // 기존 이미지 삭제
          if (imageUrl) {
            console.log('[PostsStore] Removing existing image...')
            const oldFilePath = imageUrl.split('/').pop()
            const { error: deleteError } = await supabase.storage
              .from('post-images')
              .remove([oldFilePath])

            if (deleteError) {
              console.error('[PostsStore] Error removing old image:', deleteError)
            }
          }
          imageUrl = null
        } else if (imageFile) {
          // 새 이미지 업로드
          console.log('[PostsStore] Uploading new image...')
          const fileExt = imageFile.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `${Date.now()}_${fileName}`

          // 기존 이미지가 있다면 삭제
          if (imageUrl) {
            const oldFilePath = imageUrl.split('/').pop()
            await supabase.storage.from('post-images').remove([oldFilePath])
          }

          const { error: uploadError } = await supabase.storage
            .from('post-images')
            .upload(filePath, imageFile)

          if (uploadError) {
            console.error('[PostsStore] Image upload error:', uploadError)
            throw uploadError
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from('post-images').getPublicUrl(filePath)

          imageUrl = publicUrl
          console.log('[PostsStore] New image uploaded successfully:', imageUrl)
        }

        // 게시물 업데이트
        console.log('[PostsStore] Updating post in database...')
        const { data: updatedPost, error } = await supabase
          .from('posts')
          .update({
            content,
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId)
          .select()
          .single()

        if (error) {
          console.error('[PostsStore] Post update error:', error)
          throw error
        }

        // 업데이트된 게시물 상태 반영
        const updatedFullPost = {
          ...updatedPost,
          profiles: posts.value[postIndex].profiles,
          likeCount: posts.value[postIndex].likeCount,
          commentCount: posts.value[postIndex].commentCount,
          liked: posts.value[postIndex].liked,
        }

        await Promise.resolve()
        posts.value[postIndex] = updatedFullPost
        console.log('[PostsStore] Post updated successfully')
        return updatedFullPost
      } catch (err) {
        console.error('[PostsStore] Error updating post:', err)
        throw err
      } finally {
        loading.value = false
        console.log('[PostsStore] Update post completed')
      }
    }

    async function deletePost(postId) {
      console.log('[PostsStore] Starting to delete post...', { postId })
      loading.value = true

      try {
        const post = posts.value.find((p) => p.id === postId)
        if (!post) throw new Error('게시물을 찾을 수 없습니다.')

        // 이미지가 있다면 먼저 삭제
        if (post.image_url) {
          console.log('[PostsStore] Removing post image...')
          const filePath = post.image_url.split('/').pop()
          const { error: deleteImageError } = await supabase.storage
            .from('post-images')
            .remove([filePath])

          if (deleteImageError) {
            console.error('[PostsStore] Error removing image:', deleteImageError)
          }
        }

        // 게시물 삭제
        console.log('[PostsStore] Deleting post from database...')
        const { error } = await supabase.from('posts').delete().eq('id', postId)

        if (error) {
          console.error('[PostsStore] Post deletion error:', error)
          throw error
        }

        // 상태에서 게시물 제거
        await Promise.resolve()
        posts.value = posts.value.filter((p) => p.id !== postId)
        console.log('[PostsStore] Post deleted successfully')
      } catch (err) {
        console.error('[PostsStore] Error deleting post:', err)
        throw err
      } finally {
        loading.value = false
        console.log('[PostsStore] Delete post completed')
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
      updatePost,
      deletePost,
      toggleLike,
      fetchComments,
      addComment,
      fetchPostCounts,
      fetchPost,
      addReply,
    }
  },
  {
    persist: {
      paths: ['posts'],
    },
  },
)
