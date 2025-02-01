<template>
  <q-page class="q-pa-md">
    <div v-if="initialLoading" class="flex flex-center">
      <q-spinner size="40px" color="primary" />
    </div>

    <div v-else class="q-gutter-y-md">
      <PostCard
        v-for="post in postsStore.posts"
        :key="post.id"
        :post="post"
        @click-post="openThread(post)"
        @click-comment="openComments(post)"
        @click-share="copyPostLink(post)"
      />
    </div>

    <CommentDialog v-if="selectedPostId" v-model="showComments" :post-id="selectedPostId" />
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { usePostsStore } from 'stores/posts'
import { useQuasar } from 'quasar'
import CommentDialog from 'components/CommentDialog.vue'
import PostCard from 'components/PostCard.vue'
import { useRouter } from 'vue-router'

const postsStore = usePostsStore()
const $q = useQuasar()
const router = useRouter()

const showComments = ref(false)
const selectedPostId = ref(null)
const initialLoading = ref(true)

onMounted(async () => {
  try {
    await postsStore.fetchPosts()
  } finally {
    initialLoading.value = false
  }
})

function copyPostLink(post) {
  const url = `${window.location.origin}/post/${post.id}`
  navigator.clipboard.writeText(url)
  $q.notify({
    type: 'positive',
    message: '링크가 복사되었습니다.',
  })
}

function openComments(post) {
  selectedPostId.value = post.id
  showComments.value = true
}

function openThread(post) {
  router.push(`/post/${post.id}`)
}
</script>

<style lang="scss" scoped>
.q-card {
  .q-btn {
    opacity: 0.7;
    &:hover {
      opacity: 1;
    }

    // 버튼 내부의 카운트 텍스트 스타일
    .text-caption {
      min-width: 20px;
      text-align: left;
    }
  }
}
</style>
