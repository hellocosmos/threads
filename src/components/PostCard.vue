<template>
  <q-card flat bordered>
    <!-- 게시글 내용 -->
    <div class="cursor-pointer" @click="handleCardClick" v-touch-pan.mouse="onPan">
      <q-card-section class="q-pb-none">
        <div class="row items-center">
          <!-- 아바타를 클릭했을 때 프로필 모달 표시 -->
          <q-avatar class="cursor-pointer" @click.prevent.stop="showProfileModal = true">
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
          @click.stop="showImageModal = true"
        />
      </q-card-section>

      <q-card-section class="q-pt-none text-caption text-grey">
        {{ formatDate(post.created_at) }}
      </q-card-section>
    </div>

    <!-- 액션 버튼들 -->
    <q-card-actions align="around" class="q-px-md">
      <q-btn
        flat
        round
        size="sm"
        color="grey"
        icon="chat_bubble_outline"
        @click.prevent.stop="$emit('click-comment')"
      >
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
        @click.stop="handleLike"
        :loading="post.isLikeLoading"
        :disable="post.isLikeLoading"
      >
        <q-tooltip>좋아요</q-tooltip>
        <div class="row items-center">
          <span class="q-ml-sm text-caption">{{ post.likeCount || 0 }}</span>
        </div>
      </q-btn>

      <q-btn flat round size="sm" color="grey" icon="share" @click.stop="$emit('click-share')">
        <q-tooltip>공유하기</q-tooltip>
        <q-menu>
          <q-list style="min-width: 100px">
            <q-item clickable v-close-popup @click="$emit('click-share')">
              <q-item-section>링크 복사</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-card-actions>

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

    <!-- 프로필 모달 -->
    <q-dialog v-model="showProfileModal">
      <q-card class="profile-modal">
        <q-card-section class="column items-center q-pa-lg">
          <q-avatar size="150px" class="q-mb-md">
            <q-img
              :src="
                post.profiles?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`
              "
            />
          </q-avatar>

          <div class="text-h5 q-mb-sm">{{ post.profiles?.full_name }}</div>
          <div class="text-subtitle1 q-mb-md">@{{ post.profiles?.username }}</div>

          <div class="row q-col-gutter-lg q-mb-lg">
            <div class="col text-center">
              <div class="text-h6">{{ followCounts.followersCount }}</div>
              <div class="text-subtitle2">팔로워</div>
            </div>
            <div class="col text-center">
              <div class="text-h6">{{ followCounts.followingCount }}</div>
              <div class="text-subtitle2">팔로잉</div>
            </div>
          </div>

          <q-btn
            v-if="post.profiles?.id !== userStore.user?.id"
            :color="isFollowing ? 'grey' : 'primary'"
            :label="isFollowing ? '팔로잉' : '팔로우'"
            @click="handleFollow"
            :loading="followLoading"
            class="full-width"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup>
import { ref, watch } from 'vue'
import { usePostsStore } from 'stores/posts'
import { useUserStore } from 'stores/user'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
})

defineEmits(['click-post', 'click-comment', 'click-share'])
const postsStore = usePostsStore()
const userStore = useUserStore()
const $q = useQuasar()
const router = useRouter()

const showProfileModal = ref(false)
const showImageModal = ref(false)
const isFollowing = ref(false)
const followLoading = ref(false)
const followCounts = ref({
  followersCount: 0,
  followingCount: 0,
})

// 모달이 열릴 때 팔로우 상태와 카운트 로드
watch(showProfileModal, async (newValue) => {
  if (newValue && props.post.profiles?.id) {
    await loadFollowData()
  }
})

async function loadFollowData() {
  try {
    // 다른 사용자의 프로필 정보 가져오기
    const profileData = await userStore.fetchProfile(props.post.profiles.id)
    if (!profileData) {
      throw new Error('프로필 정보를 불러올 수 없습니다.')
    }

    isFollowing.value = await userStore.isFollowing(props.post.profiles.id)
    followCounts.value = await userStore.fetchFollowCounts(props.post.profiles.id)
  } catch (err) {
    console.error('Error loading follow data:', err)
    $q.notify({
      type: 'negative',
      message: err.message || '프로필 정보를 불러올 수 없습니다.',
    })
  }
}

async function handleFollow() {
  if (!userStore.isAuthenticated) {
    $q.notify({
      type: 'negative',
      message: '로그인이 필요한 기능입니다.',
    })
    return
  }

  if (followLoading.value) return

  try {
    followLoading.value = true
    const targetUserId = props.post.user_id || props.post.profiles?.id
    if (!targetUserId) {
      throw new Error('대상 사용자 정보를 찾을 수 없습니다.')
    }

    const result = await userStore.toggleFollow(targetUserId)
    isFollowing.value = result.isFollowing
    followCounts.value = await userStore.fetchFollowCounts(targetUserId)

    $q.notify({
      type: 'positive',
      message: result.isFollowing ? '팔로우했습니다.' : '팔로우를 취소했습니다.',
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '팔로우 처리 중 오류가 발생했습니다.',
    })
  } finally {
    followLoading.value = false
  }
}

async function handleLike() {
  if (props.post.isLikeLoading) return

  try {
    // 로딩 상태 설정
    const postIndex = postsStore.posts.findIndex((p) => p.id === props.post.id)
    if (postIndex !== -1) {
      postsStore.posts[postIndex] = { ...props.post, isLikeLoading: true }
    }

    // 좋아요 토글
    await postsStore.toggleLike(props.post.id)
  } catch (err) {
    // 에러 시 로딩 상태 해제
    const postIndex = postsStore.posts.findIndex((p) => p.id === props.post.id)
    if (postIndex !== -1) {
      postsStore.posts[postIndex] = { ...props.post, isLikeLoading: false }
    }

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

function onPan() {
  // 터치 이벤트 핸들러 제거
}

function handleCardClick(evt) {
  evt.preventDefault()
  evt.stopPropagation()
  router.push(`/post/${props.post.id}`)
}
</script>

<style lang="scss" scoped>
.q-card {
  touch-action: pan-y; /* 수직 스크롤만 허용 */
  .q-img {
    &.cursor-pointer {
      transition: opacity 0.3s;
      &:hover {
        opacity: 0.9;
      }
    }
  }
  .q-btn {
    opacity: 0.7;
    &:hover {
      opacity: 1;
    }

    .text-caption {
      min-width: 20px;
      text-align: left;
    }
  }
}

.profile-modal {
  width: 400px;
  max-width: 95vw;
  border-radius: 16px;
}

.post-card {
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }
}
</style>
