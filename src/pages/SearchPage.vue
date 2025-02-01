<template>
  <q-page class="q-pa-md">
    <!-- 검색 입력창 -->
    <div class="row q-mb-md">
      <q-input
        v-model="searchQuery"
        outlined
        dense
        class="col"
        placeholder="검색어를 입력하세요"
        @keyup.enter="handleSearch"
      >
        <template v-slot:append>
          <q-icon
            v-if="searchQuery"
            name="close"
            class="cursor-pointer"
            @click="searchQuery = ''"
          />
          <q-btn flat round dense icon="search" @click="handleSearch" :loading="loading" />
        </template>
      </q-input>
    </div>

    <!-- 검색 결과 탭 -->
    <q-tabs
      v-model="activeTab"
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
      align="justify"
      narrow-indicator
    >
      <q-tab name="posts" label="게시물" />
      <q-tab name="users" label="사용자" />
    </q-tabs>

    <!-- 검색 결과 표시 -->
    <q-tab-panels v-model="activeTab" animated>
      <!-- 게시물 검색 결과 -->
      <q-tab-panel name="posts">
        <div v-if="loading" class="text-center q-pa-md">
          <q-spinner color="primary" size="2em" />
        </div>
        <div v-else-if="posts.length === 0" class="text-center text-grey q-pa-lg">
          검색 결과가 없습니다.
        </div>
        <post-card
          v-else
          v-for="post in posts"
          :key="post.id"
          :post="post"
          class="q-mb-md"
          @click-comment="openComments(post)"
          @click-share="copyPostLink(post)"
        />
      </q-tab-panel>

      <!-- 사용자 검색 결과 -->
      <q-tab-panel name="users">
        <div v-if="loading" class="text-center q-pa-md">
          <q-spinner color="primary" size="2em" />
        </div>
        <div v-else-if="users.length === 0" class="text-center text-grey q-pa-lg">
          검색 결과가 없습니다.
        </div>
        <q-list v-else>
          <q-item
            v-for="user in users"
            :key="user.id"
            clickable
            v-ripple
            @click="goToProfile(user.id)"
          >
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
          </q-item>
        </q-list>
      </q-tab-panel>
    </q-tab-panels>

    <!-- 댓글 다이얼로그 -->
    <comment-dialog v-model="showComments" :post-id="selectedPost?.id" />
  </q-page>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import useSupabase from 'boot/supabase'
import { useUserStore } from 'stores/user'
import PostCard from 'components/PostCard.vue'
import CommentDialog from 'components/CommentDialog.vue'
import { useQuasar } from 'quasar'

const { supabase } = useSupabase()
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const $q = useQuasar()

const searchQuery = ref('')
const activeTab = ref('posts')
const loading = ref(false)
const posts = ref([])
const users = ref([])
const showComments = ref(false)
const selectedPost = ref(null)

// URL 쿼리 파라미터로 검색어와 탭 상태 유지
watch(
  () => route.query,
  (newQuery) => {
    searchQuery.value = newQuery.q || ''
    activeTab.value = newQuery.tab || 'posts'
  },
)

// 컴포넌트 마운트 시 URL에 검색어가 있으면 검색 실행
onMounted(() => {
  if (route.query.q?.trim()) {
    searchQuery.value = route.query.q
    activeTab.value = route.query.tab || 'posts'
    handleSearch()
  }
})

// 검색 실행
async function handleSearch() {
  if (!searchQuery.value.trim()) return

  loading.value = true
  try {
    // URL 업데이트
    router.push({
      query: {
        q: searchQuery.value,
        tab: activeTab.value,
      },
    })

    if (activeTab.value === 'posts') {
      await searchPosts()
    } else {
      await searchUsers()
    }
  } catch (err) {
    console.error('Search error:', err)
    $q.notify({
      type: 'negative',
      message: '검색 중 오류가 발생했습니다.',
    })
  } finally {
    loading.value = false
  }
}

// 게시물 검색
async function searchPosts() {
  try {
    // 검색어가 없으면 검색하지 않음
    if (!searchQuery.value.trim()) {
      posts.value = []
      return
    }

    // 게시물 검색
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .ilike('content', `%${searchQuery.value}%`)
      .order('created_at', { ascending: false })

    if (postsError) throw postsError

    // 각 게시물의 프로필, 좋아요, 댓글 수 가져오기
    const postsWithCounts = await Promise.all(
      (postsData || []).map(async (post) => {
        // 프로필 정보 가져오기
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', post.user_id)
          .single()

        // 좋아요와 댓글 수 가져오기
        const [{ count: likeCount }, { count: commentCount }, { data: likeData }] =
          await Promise.all([
            supabase
              .from('likes')
              .select('id', { count: 'exact', head: true })
              .eq('post_id', post.id),
            supabase
              .from('comments')
              .select('id', { count: 'exact', head: true })
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

    posts.value = postsWithCounts
  } catch (err) {
    console.error('Error searching posts:', err)
    $q.notify({
      type: 'negative',
      message: '게시물 검색 중 오류가 발생했습니다.',
    })
    posts.value = []
  }
}

// 사용자 검색도 개선
async function searchUsers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.%${searchQuery.value}%,full_name.ilike.%${searchQuery.value}%`)
      .order('username')

    if (error) {
      throw error
    }

    users.value = data || []
  } catch (err) {
    console.error('Error searching users:', err)
    $q.notify({
      type: 'negative',
      message: '사용자 검색 중 오류가 발생했습니다.',
    })
    users.value = []
  }
}

// 프로필 페이지로 이동
function goToProfile(userId) {
  router.push(`/profile/${userId}`)
}

function openComments(post) {
  selectedPost.value = post
  showComments.value = true
}

function copyPostLink(post) {
  navigator.clipboard.writeText(`${window.location.origin}/thread/${post.id}`)
  $q.notify({
    type: 'positive',
    message: '링크가 복사되었습니다.',
  })
}
</script>
