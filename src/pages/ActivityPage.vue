<template>
  <q-page class="q-pa-md">
    <!-- 상단 탭 -->
    <q-tabs
      v-model="activeTab"
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
      align="justify"
      narrow-indicator
    >
      <q-tab name="trending" label="인기" />
      <q-tab name="followers" label="팔로워" />
      <q-tab name="following" label="팔로잉" />
    </q-tabs>

    <!-- 로딩 표시 -->
    <div v-if="loading" class="text-center q-pa-md">
      <q-spinner color="primary" size="2em" />
    </div>

    <!-- 인기 게시물 목록 -->
    <div v-else-if="activeTab === 'trending'">
      <div v-if="trendingPosts.length === 0" class="text-center text-grey q-pa-lg">
        인기 게시물이 없습니다.
      </div>

      <post-card
        v-else
        v-for="post in trendingPosts"
        :key="post.id"
        :post="post"
        class="q-mb-md"
        @click-comment="openComments(post)"
        @click-share="copyPostLink(post)"
      />
    </div>

    <!-- 팔로워/팔로잉 목록 -->
    <q-list v-else padding>
      <div v-if="users.length === 0" class="text-center text-grey q-pa-lg">
        {{ activeTab === 'followers' ? '팔로워' : '팔로잉' }}가 없습니다.
      </div>

      <q-item v-for="user in users" :key="user.id" clickable v-ripple @click="goToProfile(user.id)">
        <q-item-section avatar>
          <q-avatar>
            <q-img
              :src="
                user.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`
              "
            />
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ user.full_name }}</q-item-label>
          <q-item-label caption>@{{ user.username }}</q-item-label>
        </q-item-section>

        <q-item-section side v-if="user.id !== userStore.user?.id">
          <q-btn
            :color="user.isFollowing ? 'grey' : 'primary'"
            :label="user.isFollowing ? '팔로잉' : '팔로우'"
            rounded
            dense
            @click.stop="toggleFollow(user)"
          />
        </q-item-section>
      </q-item>
    </q-list>

    <!-- 댓글 다이얼로그 -->
    <comment-dialog v-model="showComments" :post-id="selectedPost?.id" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from 'stores/user'
import useSupabase from 'boot/supabase'
import { useQuasar } from 'quasar'
import PostCard from 'components/PostCard.vue'
import CommentDialog from 'components/CommentDialog.vue'

const { supabase } = useSupabase()
const userStore = useUserStore()
const router = useRouter()
const $q = useQuasar()

const activeTab = ref('trending')
const loading = ref(false)
const users = ref([])
const trendingPosts = ref([])
const showComments = ref(false)
const selectedPost = ref(null)

// 팔로워/팔로잉 목록 로드
async function loadUsers() {
  if (loading.value) return

  loading.value = true
  try {
    const userId = userStore.user?.id
    let query

    if (activeTab.value === 'followers') {
      // 팔로워 목록
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)

      const followerIds = followers.map((f) => f.follower_id)
      query = supabase.from('profiles').select('*').in('id', followerIds)
    } else {
      // 팔로잉 목록
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)

      const followingIds = following.map((f) => f.following_id)
      query = supabase.from('profiles').select('*').in('id', followingIds)
    }

    const { data } = await query
    users.value = await Promise.all(
      (data || []).map(async (user) => {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', userId)
          .eq('following_id', user.id)
          .maybeSingle()

        return {
          ...user,
          isFollowing: !!followData,
        }
      }),
    )
  } catch (err) {
    console.error('Error loading users:', err)
    $q.notify({
      type: 'negative',
      message: '사용자 목록을 불러오는데 실패했습니다.',
    })
  } finally {
    loading.value = false
  }
}

// 인기 게시물 로드 (좋아요 수 기준)
async function loadTrendingPosts() {
  if (loading.value) return

  loading.value = true
  try {
    // 먼저 모든 게시물 가져오기
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!posts?.length) {
      trendingPosts.value = []
      return
    }

    // 각 게시물의 프로필, 좋아요, 댓글 수 계산
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        // 프로필 정보 가져오기
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', post.user_id)
          .single()

        // 좋아요 수와 댓글 수를 한 번에 가져오기
        const [{ count: likeCount }, { count: commentCount }, { data: likeData }] =
          await Promise.all([
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
          likeCount: likeCount || 0,
          commentCount: commentCount || 0,
          liked: !!likeData,
        }
      }),
    )

    // 좋아요 수로 정렬하고 상위 20개만 선택
    trendingPosts.value = postsWithCounts.sort((a, b) => b.likeCount - a.likeCount).slice(0, 20)
  } catch (err) {
    console.error('Error loading trending posts:', err)
    trendingPosts.value = []
  } finally {
    loading.value = false
  }
}

// 팔로우/언팔로우 토글
async function toggleFollow(user) {
  try {
    const userId = userStore.user?.id
    if (user.isFollowing) {
      // 언팔로우
      await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', user.id)
    } else {
      // 팔로우
      await supabase.from('follows').insert({
        follower_id: userId,
        following_id: user.id,
      })
    }

    // 목록 새로고침
    await loadUsers()
  } catch (err) {
    console.error('Error toggling follow:', err)
    $q.notify({
      type: 'negative',
      message: '작업 중 오류가 발생했습니다.',
    })
  }
}

function goToProfile(userId) {
  router.push(`/profile/${userId}`)
}

function openComments(post) {
  selectedPost.value = post
  showComments.value = true
}

function copyPostLink(post) {
  navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)
  $q.notify({
    type: 'positive',
    message: '링크가 복사되었습니다.',
  })
}

// 탭 변경 시 데이터 로드
watch(activeTab, () => {
  if (['followers', 'following'].includes(activeTab.value)) {
    loadUsers()
  } else {
    loadTrendingPosts()
  }
})

// 컴포넌트 마운트 시 인기 게시물 먼저 로드
onMounted(() => {
  loadTrendingPosts()
})
</script>
