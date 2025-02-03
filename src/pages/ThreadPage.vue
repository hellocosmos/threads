<template>
  <q-page class="q-pa-md">
    <!-- 상단 헤더 -->
    <div class="row items-center justify-between q-mb-md">
      <div class="row items-center">
        <q-btn flat round icon="arrow_back" @click="router.back()" class="q-mr-sm">
          <q-tooltip>돌아가기</q-tooltip>
        </q-btn>
        <div class="text-h5">스레드</div>
      </div>
    </div>

    <!-- 원본 게시물 -->
    <q-card v-if="post" flat bordered class="q-mb-md">
      <q-card-section class="q-pb-none">
        <div class="row items-center">
          <q-avatar>
            <q-img
              :src="
                post.profiles?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`
              "
            />
          </q-avatar>
          <div class="q-ml-sm">
            <div class="text-weight-bold">{{ post.profiles?.full_name }}</div>
            <div class="text-caption">@{{ post.profiles?.username }}</div>
          </div>
        </div>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">{{ post.content }}</div>
        <q-img
          v-if="post.image_url"
          :src="post.image_url"
          :ratio="16 / 9"
          fit="contain"
          class="q-mt-sm rounded-borders cursor-pointer"
          style="background-color: black"
          @click="showImageModal = true"
        />
      </q-card-section>

      <q-card-section class="q-pt-none text-caption text-grey">
        {{ formatDate(post.created_at) }}
      </q-card-section>

      <q-card-actions align="around" class="q-px-md">
        <q-btn flat round size="sm" color="grey" icon="chat_bubble_outline">
          <q-tooltip>댓글</q-tooltip>
          <div class="row items-center">
            <span class="q-ml-sm text-caption">{{ post.commentCount || 0 }}</span>
          </div>
        </q-btn>

        <q-btn flat round size="sm" color="grey" icon="repeat">
          <q-tooltip>리포스트</q-tooltip>
        </q-btn>

        <q-btn
          flat
          round
          size="sm"
          :color="post.liked ? 'red' : 'grey'"
          :icon="post.liked ? 'favorite' : 'favorite_border'"
          @click="toggleLike"
          :loading="post.isLikeLoading"
          :disable="post.isLikeLoading"
        >
          <q-tooltip>좋아요</q-tooltip>
          <div class="row items-center">
            <span class="q-ml-sm text-caption">{{ post.likeCount || 0 }}</span>
          </div>
        </q-btn>

        <q-btn flat round size="sm" color="grey" icon="share">
          <q-tooltip>공유하기</q-tooltip>
          <q-menu>
            <q-list style="min-width: 100px">
              <q-item clickable v-close-popup @click="copyPostLink(post)">
                <q-item-section>링크 복사</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-card-actions>
    </q-card>

    <!-- 댓글 작성 영역 -->
    <q-card flat bordered class="q-mb-md">
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
      <q-card-actions align="right">
        <q-btn
          flat
          label="답글"
          color="primary"
          :disable="!newComment.trim()"
          @click="submitComment"
          :loading="isSubmitting"
        />
      </q-card-actions>
    </q-card>

    <!-- 댓글 목록 -->
    <div v-if="loading" class="flex flex-center q-pa-md">
      <q-spinner size="40px" color="primary" />
    </div>
    <template v-else>
      <q-card v-for="comment in comments" :key="comment.id" flat bordered class="q-mb-sm">
        <q-card-section>
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
                <div class="text-caption text-grey q-ml-sm">@{{ comment.profiles?.username }}</div>
                <div class="text-caption text-grey q-ml-sm">
                  · {{ formatDate(comment.created_at) }}
                </div>
              </div>
              <div class="text-body1 q-mt-sm">{{ comment.content }}</div>

              <!-- 답글 버튼 -->
              <div class="q-mt-sm">
                <q-btn
                  flat
                  dense
                  size="sm"
                  color="grey"
                  label="답글"
                  @click="openReplyInput(comment)"
                />
              </div>

              <!-- 답글 작성 영역 -->
              <div v-if="replyingTo === comment.id" class="q-mt-md">
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
                      dense
                      class="text-body2"
                    />
                    <div class="row justify-end q-gutter-sm q-mt-sm">
                      <q-btn flat dense label="취소" color="grey" @click="cancelReply" />
                      <q-btn
                        flat
                        dense
                        label="답글"
                        color="primary"
                        :disable="!replyContent.trim()"
                        :loading="isSubmittingReply"
                        @click="submitReply(comment)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 대댓글 목록 -->
              <div v-if="comment.replies?.length" class="q-ml-lg q-mt-md">
                <q-card
                  v-for="reply in comment.replies"
                  :key="reply.id"
                  flat
                  bordered
                  class="q-mb-sm"
                >
                  <q-card-section>
                    <div class="row items-start">
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
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </template>

    <!-- 이미지 확대 모달 -->
    <q-dialog v-model="showImageModal" maximized>
      <q-card class="bg-black">
        <q-card-section class="row items-center q-pb-none">
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup class="text-white" />
        </q-card-section>
        <q-card-section class="column items-center justify-center" style="height: 90vh">
          <q-img
            :src="post.image_url"
            fit="contain"
            style="max-width: 100%; max-height: 100%"
            no-spinner
          >
            <template v-slot:loading>
              <q-spinner-dots color="white" size="40px" />
            </template>
          </q-img>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePostsStore } from 'stores/posts'
import { useUserStore } from 'stores/user'
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const postsStore = usePostsStore()
const userStore = useUserStore()
const $q = useQuasar()

// store의 상태를 refs로 분리
const { loading } = storeToRefs(postsStore)

const post = ref(null)
const comments = ref([])
const newComment = ref('')
const isSubmitting = ref(false)
const replyingTo = ref(null)
const replyContent = ref('')
const isSubmittingReply = ref(false)
const showImageModal = ref(false)

onMounted(async () => {
  try {
    await loadPost()
    await loadComments()
    await userStore.fetchProfile()
  } catch (err) {
    console.error('Error loading thread:', err)
    $q.notify({
      type: 'negative',
      message: '게시물을 불러오는데 실패했습니다.',
    })
    router.push('/')
  } finally {
    loading.value = false
  }
})

async function loadPost() {
  const postId = route.params.id
  const { data, error } = await postsStore.fetchPost(postId)
  if (error) throw error
  post.value = data
}

async function loadComments() {
  const postId = route.params.id
  comments.value = await postsStore.fetchComments(postId)
}

async function submitComment() {
  if (!newComment.value.trim() || isSubmitting.value) return

  try {
    isSubmitting.value = true
    await postsStore.addComment(post.value.id, newComment.value)
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
  } finally {
    isSubmitting.value = false
  }
}

async function toggleLike() {
  if (post.value.isLikeLoading) return

  try {
    // 게시물 상태 업데이트를 위해 posts store에 현재 게시물 추가
    postsStore.posts = [post.value]

    // posts store의 toggleLike 함수 사용
    await postsStore.toggleLike(post.value.id)

    // 업데이트된 게시물 상태 가져오기
    post.value = postsStore.posts[0]
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '좋아요 처리 중 오류가 발생했습니다.',
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

function copyPostLink(post) {
  const url = `${window.location.origin}/post/${post.id}`
  navigator.clipboard.writeText(url)
  $q.notify({
    type: 'positive',
    message: '링크가 복사되었습니다.',
  })
}

// 답글 입력창 열기
function openReplyInput(comment) {
  replyingTo.value = comment.id
  replyContent.value = ''
}

// 답글 입력 취소
function cancelReply() {
  replyingTo.value = null
  replyContent.value = ''
}

// 답글 제출
async function submitReply(comment) {
  if (!replyContent.value.trim() || isSubmittingReply.value) return

  try {
    isSubmittingReply.value = true
    await postsStore.addReply(post.value.id, comment.id, replyContent.value)
    await loadComments()
    cancelReply()
    $q.notify({
      type: 'positive',
      message: '답글이 작성되었습니다.',
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '답글 작성에 실패했습니다.',
    })
  } finally {
    isSubmittingReply.value = false
  }
}
</script>

<style lang="scss" scoped>
.q-img {
  &.cursor-pointer {
    transition: opacity 0.3s;
    &:hover {
      opacity: 0.9;
    }
  }
}

.comment-input {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
}
</style>
