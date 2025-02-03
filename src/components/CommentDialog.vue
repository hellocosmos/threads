<template>
  <q-dialog v-model="show" persistent>
    <q-card style="width: 600px; max-width: 95vw">
      <!-- 헤더 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">답글</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 원본 게시물 -->
      <q-card-section class="q-pt-md">
        <div class="row items-start">
          <q-avatar size="40px">
            <q-img
              :src="
                post?.profiles?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${post?.profiles?.username}`
              "
            />
          </q-avatar>
          <div class="col q-ml-md">
            <div class="row items-center">
              <div class="text-subtitle1 text-weight-bold">{{ post?.profiles?.full_name }}</div>
              <div class="text-caption text-grey q-ml-sm">@{{ post?.profiles?.username }}</div>
            </div>
            <div class="text-body1 q-mt-sm">{{ post?.content }}</div>
            <div class="text-caption text-grey q-mt-sm">{{ formatDate(post?.created_at) }}</div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <!-- 댓글 작성 영역 -->
      <q-card-section>
        <div class="row items-start">
          <q-avatar size="40px">
            <q-img
              :src="
                userStore.profile?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${userStore.profile?.username}`
              "
            />
          </q-avatar>
          <div class="col q-ml-md">
            <q-input
              v-model="newComment"
              placeholder="답글 게시하기"
              type="textarea"
              autogrow
              borderless
              class="text-body1"
            />
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <!-- 댓글 목록 -->
      <q-card-section class="q-py-none" style="max-height: 50vh; overflow: auto">
        <div v-if="loading" class="flex flex-center q-pa-md">
          <q-spinner size="40px" color="primary" />
        </div>
        <div v-else class="q-py-md">
          <div v-for="comment in comments" :key="comment.id" class="q-mb-lg">
            <!-- 댓글 내용 -->
            <div class="row items-start">
              <q-avatar size="40px">
                <q-img
                  :src="
                    comment.profiles?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.profiles?.username}`
                  "
                />
              </q-avatar>
              <div class="col q-ml-md">
                <div class="row items-center">
                  <div class="text-subtitle1 text-weight-bold">
                    {{ comment.profiles?.full_name }}
                  </div>
                  <div class="text-caption text-grey q-ml-sm">
                    @{{ comment.profiles?.username }}
                  </div>
                  <div class="text-caption text-grey q-ml-sm">
                    · {{ formatDate(comment.created_at) }}
                  </div>
                </div>
                <div class="text-body1 q-mt-sm">{{ comment.content }}</div>
                <q-btn
                  flat
                  dense
                  size="sm"
                  color="grey"
                  label="답글"
                  @click="replyingTo = comment"
                />
              </div>
            </div>

            <!-- 대댓글 작성 영역 -->
            <div v-if="replyingTo?.id === comment.id" class="q-ml-xl q-mt-md">
              <div class="row items-start">
                <q-avatar size="32px">
                  <q-img
                    :src="
                      userStore.profile?.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${userStore.profile?.username}`
                    "
                  />
                </q-avatar>
                <div class="col q-ml-md">
                  <q-input
                    v-model="replyContent"
                    placeholder="답글 작성하기"
                    type="textarea"
                    autogrow
                    borderless
                    class="text-body2"
                    :loading="isSubmitting"
                  />
                  <div class="row justify-end q-gutter-sm q-mt-sm">
                    <q-btn
                      flat
                      label="취소"
                      color="grey"
                      @click="cancelReply"
                      :disable="isSubmitting"
                    />
                    <q-btn
                      flat
                      label="답글"
                      color="primary"
                      :disable="!replyContent.trim() || isSubmitting"
                      @click="submitReply(comment)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 대댓글 목록 -->
            <div v-if="comment.replies?.length" class="q-ml-xl q-mt-md">
              <div v-for="reply in comment.replies" :key="reply.id" class="row items-start q-mb-md">
                <q-avatar size="32px">
                  <q-img
                    :src="
                      reply.profiles?.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.profiles?.username}`
                    "
                  />
                </q-avatar>
                <div class="col q-ml-md">
                  <div class="row items-center">
                    <div class="text-subtitle2 text-weight-bold">
                      {{ reply.profiles?.full_name }}
                    </div>
                    <div class="text-caption text-grey q-ml-sm">
                      @{{ reply.profiles?.username }}
                    </div>
                    <div class="text-caption text-grey q-ml-sm">
                      · {{ formatDate(reply.created_at) }}
                    </div>
                  </div>
                  <div class="text-body2 q-mt-sm">{{ reply.content }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <!-- 하단 버튼 -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          flat
          label="답글"
          color="primary"
          :disable="!newComment.trim()"
          @click="submitComment"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { usePostsStore } from 'stores/posts'
import { useUserStore } from 'stores/user'
import { useQuasar } from 'quasar'
import useSupabase from 'boot/supabase'

const { supabase } = useSupabase()

const props = defineProps({
  modelValue: Boolean,
  postId: {
    type: String,
    required: false,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])
const postsStore = usePostsStore()
const userStore = useUserStore()
const $q = useQuasar()

const show = ref(props.modelValue)
const comments = ref([])
const newComment = ref('')
const loading = ref(false)
const post = ref(null)

// 대댓글 관련 상태 추가
const replyingTo = ref(null)
const replyContent = ref('')
const isSubmitting = ref(false)

watch(
  () => props.modelValue,
  (val) => {
    show.value = val
  },
)

watch(show, (val) => {
  emit('update:modelValue', val)
  if (!val) {
    newComment.value = ''
  }
})

watch(
  () => props.postId,
  async (newPostId) => {
    if (newPostId) {
      await loadPost()
      await loadComments()
    }
  },
)

onMounted(async () => {
  try {
    if (props.postId) {
      await loadPost()
      await loadComments()
    }
    await userStore.fetchProfile()
  } catch (err) {
    console.error('컴포넌트 초기화 오류:', err)
  }
})

async function loadPost() {
  try {
    // 먼저 post 데이터를 가져옵니다
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', props.postId)
      .single()

    if (postError) throw postError

    // 그 다음 profile 데이터를 가져옵니다
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url, full_name')
      .eq('id', postData.user_id)
      .single()

    if (profileError) throw profileError

    // 두 데이터를 합칩니다
    post.value = {
      ...postData,
      profiles: profileData,
    }
  } catch (err) {
    console.error('Error loading post:', err)
  }
}

async function loadComments() {
  try {
    if (!props.postId) return

    loading.value = true
    comments.value = await postsStore.fetchComments(props.postId)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '댓글을 불러오는데 실패했습니다.',
    })
  } finally {
    loading.value = false
  }
}

async function submitComment() {
  try {
    await postsStore.addComment(props.postId, newComment.value)
    newComment.value = ''
    await loadComments()
    $q.notify({
      type: 'positive',
      message: '댓글이 작성되었습니다.',
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '댓글 작성에 실패했습니다.',
    })
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function submitReply(parentComment) {
  if (!replyContent.value.trim()) return

  try {
    isSubmitting.value = true
    const newReply = await postsStore.addReply(props.postId, parentComment.id, replyContent.value)

    // 부모 댓글의 replies 배열에 새 대댓글 추가
    const commentIndex = comments.value.findIndex((c) => c.id === parentComment.id)
    if (commentIndex !== -1) {
      if (!comments.value[commentIndex].replies) {
        comments.value[commentIndex].replies = []
      }
      comments.value[commentIndex].replies.push(newReply)
    }

    replyContent.value = ''
    replyingTo.value = null
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '대댓글 작성 중 오류가 발생했습니다.',
    })
  } finally {
    isSubmitting.value = false
  }
}

function cancelReply() {
  replyContent.value = ''
  replyingTo.value = null
}
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 16px;
}
</style>
