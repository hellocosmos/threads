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
import { ref, watch, onMounted, onDeactivated, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSearchStore } from 'stores/search'
import PostCard from 'components/PostCard.vue'
import CommentDialog from 'components/CommentDialog.vue'
import { useQuasar } from 'quasar'

const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const searchStore = useSearchStore()

const searchQuery = ref('')
const activeTab = ref('posts')
const loading = computed(() => searchStore.loading)
const posts = computed(() => searchStore.posts)
const users = computed(() => searchStore.users)
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
  console.log('[SearchPage] Component mounted', {
    query: route.query.q,
    tab: route.query.tab,
  })
  if (route.query.q?.trim()) {
    searchQuery.value = route.query.q
    activeTab.value = route.query.tab || 'posts'
    handleSearch()
  }
})

// 검색어가 비워질 때 결과를 리셋하도록 watch 추가
watch(searchQuery, (newValue) => {
  if (!newValue.trim()) {
    searchStore.clearResults()
  }
})

// 탭이 변경될 때도 결과를 리셋
watch(activeTab, () => {
  searchStore.clearResults()
})

// 검색 실행
async function handleSearch() {
  if (!searchQuery.value.trim()) return

  try {
    if (activeTab.value === 'posts') {
      await searchStore.searchPosts(searchQuery.value)
    } else {
      await searchStore.searchUsers(searchQuery.value)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '검색 중 오류가 발생했습니다.',
    })
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

// 컴포넌트가 비활성화될 때 검색 상태 초기화
onDeactivated(() => {
  console.log('[SearchPage] Component deactivated')
  searchStore.clearResults()
  searchQuery.value = ''
  activeTab.value = 'posts'
})

defineExpose({
  handleSearch,
})
</script>
