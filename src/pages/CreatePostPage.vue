<template>
  <q-page class="q-pa-md">
    <div class="row justify-center">
      <div class="col-12 col-sm-8 col-md-6">
        <div class="text-h5 q-mb-md">{{ isEdit ? '게시물 수정' : '새 게시물 작성' }}</div>

        <create-post
          v-if="!loading"
          :initial-post="post"
          :is-edit="isEdit"
          @post-created="onPostCreated"
          @post-updated="onPostUpdated"
          @close="onClose"
        />

        <!-- 로딩 중일 때 표시 -->
        <div v-else class="flex flex-center q-pa-lg">
          <q-spinner size="40px" color="primary" />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePostsStore } from 'stores/posts'
import { useQuasar } from 'quasar'
import CreatePost from 'components/CreatePost.vue'

const router = useRouter()
const route = useRoute()
const postsStore = usePostsStore()
const $q = useQuasar()

const post = ref(null)
const loading = ref(false)
const isEdit = computed(() => !!route.params.id)

// 게시물 데이터 로드
onMounted(async () => {
  if (isEdit.value) {
    loading.value = true
    try {
      const { data, error } = await postsStore.fetchPost(route.params.id)
      if (error) throw error
      post.value = data
    } catch (err) {
      console.error('Error loading post:', err)
      $q.notify({
        type: 'negative',
        message: '게시물을 불러올 수 없습니다.',
      })
      router.push('/')
    } finally {
      loading.value = false
    }
  }
})

function onPostCreated() {
  $q.notify({
    type: 'positive',
    message: '게시물이 작성되었습니다.',
  })
  router.push('/')
}

function onPostUpdated() {
  $q.notify({
    type: 'positive',
    message: '게시물이 수정되었습니다.',
  })
  router.push('/')
}

function onClose() {
  router.push('/')
}
</script>
