<template>
  <q-page class="q-pa-md">
    <!-- 프로필 헤더 -->
    <div v-if="profileStore.profile" class="row q-col-gutter-md">
      <div class="col-12">
        <div class="row items-center q-col-gutter-md">
          <!-- 아바타 -->
          <div class="col-auto">
            <q-avatar size="100px" class="cursor-pointer" @click="openAvatarDialog">
              <q-img
                :src="
                  profileStore.profile.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileStore.profile.username}`
                "
              />
            </q-avatar>
          </div>

          <!-- 프로필 정보 -->
          <div class="col">
            <div class="text-h6">{{ profileStore.profile.full_name }}</div>
            <div class="text-subtitle1">@{{ profileStore.profile.username }}</div>
            <div class="q-mt-sm">{{ profileStore.profile.bio || '소개가 없습니다.' }}</div>

            <!-- 팔로워/팔로잉 정보 -->
            <div class="row q-mt-md">
              <div class="col-auto q-mr-md">
                <span class="text-weight-bold">{{ followCounts.followersCount }}</span> 팔로워
              </div>
              <div class="col-auto">
                <span class="text-weight-bold">{{ followCounts.followingCount }}</span> 팔로잉
              </div>
            </div>
          </div>

          <!-- 프로필 수정 버튼 -->
          <div class="col-auto" v-if="isCurrentUser">
            <q-btn flat round icon="edit" @click="openEditDialog" />
          </div>
        </div>
      </div>

      <!-- 탭 메뉴 -->
      <div class="col-12">
        <q-tabs
          v-model="activeTab"
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="threads" label="쓰레드" />
          <q-tab name="replies" label="답글" />
          <q-tab name="reposts" label="리포스트" />
        </q-tabs>
      </div>

      <!-- 탭 컨텐츠 -->
      <div class="col-12">
        <!-- 쓰레드 탭 -->
        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="threads">
            <div v-if="userPosts.length === 0" class="text-center text-grey q-pa-lg">
              작성한 쓰레드가 없습니다.
            </div>
            <post-card
              v-else
              v-for="post in userPosts"
              :key="post.id"
              :post="post"
              class="q-mb-md"
              @click-comment="openComments(post)"
              @click-share="copyPostLink(post)"
            />
          </q-tab-panel>

          <!-- 답글 탭 -->
          <q-tab-panel name="replies">
            <div v-if="userReplies.length === 0" class="text-center text-grey q-pa-lg">
              작성한 답글이 없습니다.
            </div>
            <post-card
              v-else
              v-for="reply in userReplies"
              :key="reply.id"
              :post="reply"
              class="q-mb-md"
              @click-comment="openComments(reply)"
              @click-share="copyPostLink(reply)"
            />
          </q-tab-panel>

          <!-- 리포스트 탭 -->
          <q-tab-panel name="reposts">
            <div v-if="userReposts.length === 0" class="text-center text-grey q-pa-lg">
              리포스트한 게시물이 없습니다.
            </div>
            <post-card
              v-else
              v-for="repost in userReposts"
              :key="repost.id"
              :post="repost"
              class="q-mb-md"
              @click-comment="openComments(repost)"
              @click-share="copyPostLink(repost)"
            />
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>

    <!-- 프로필 수정 다이얼로그 -->
    <q-dialog v-model="editDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">프로필 수정</div>
        </q-card-section>

        <q-card-section>
          <q-input v-model="editForm.fullName" label="이름" outlined dense />
          <q-input v-model="editForm.username" label="사용자명" class="q-mt-sm" outlined dense />
          <q-input
            v-model="editForm.bio"
            label="소개"
            type="textarea"
            class="q-mt-sm"
            outlined
            dense
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="취소" color="primary" v-close-popup />
          <q-btn
            flat
            label="저장"
            color="primary"
            @click="saveProfile"
            :loading="profileStore.loading"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 아바타 변경 다이얼로그 -->
    <q-dialog v-model="showAvatarDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">프로필 이미지 변경</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="row items-center justify-center q-gutter-md">
            <!-- 이미지 미리보기 -->
            <q-avatar size="150px">
              <q-img
                v-if="avatarPreview"
                :src="avatarPreview"
                style="width: 150px; height: 150px"
              />
              <q-img
                v-else
                :src="
                  profileStore.profile.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileStore.profile.username}`
                "
              />
            </q-avatar>
          </div>

          <!-- 파일 업로드 버튼 -->
          <div class="row justify-center q-mt-md">
            <q-btn color="primary" label="이미지 선택" @click="selectImage" :loading="uploading" />
            <input
              type="file"
              ref="fileInput"
              accept="image/*"
              style="display: none"
              @change="onFileSelected"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="취소" color="primary" v-close-popup />
          <q-btn
            flat
            label="저장"
            color="primary"
            @click="saveAvatar"
            :loading="uploading"
            :disable="!selectedFile"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 댓글 다이얼로그 -->
    <comment-dialog v-model="showComments" :post-id="selectedPost?.id" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useProfileStore } from 'stores/profile'
import { useUserStore } from 'stores/user'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import PostCard from 'components/PostCard.vue'
import CommentDialog from 'components/CommentDialog.vue'
import useSupabase from 'boot/supabase'

const { supabase } = useSupabase()
const profileStore = useProfileStore()
const userStore = useUserStore()
const route = useRoute()
const $q = useQuasar()

const activeTab = ref('threads')
const editDialog = ref(false)
const showComments = ref(false)
const selectedPost = ref(null)
const userPosts = ref([])
const userReplies = ref([])
const userReposts = ref([])
const showAvatarDialog = ref(false)
const fileInput = ref(null)
const selectedFile = ref(null)
const avatarPreview = ref(null)
const uploading = ref(false)

const editForm = ref({
  fullName: '',
  username: '',
  bio: '',
})

const isCurrentUser = computed(() => {
  return userStore.user?.id === profileStore.profile?.id
})

const followCounts = ref({
  followersCount: 0,
  followingCount: 0,
})

onMounted(async () => {
  const userId = route.params.id || userStore.user?.id
  if (userId) {
    await profileStore.fetchProfile(userId)
    if (profileStore.profile) {
      editForm.value = {
        fullName: profileStore.profile.full_name,
        username: profileStore.profile.username,
        bio: profileStore.profile.bio,
      }
    }
  }

  await loadProfile()
  await loadUserContent()
})

function openEditDialog() {
  editDialog.value = true
}

async function saveProfile() {
  try {
    await profileStore.updateProfile(editForm.value)
    editDialog.value = false
    $q.notify({
      type: 'positive',
      message: '프로필이 업데이트되었습니다.',
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '프로필 업데이트에 실패했습니다.',
    })
  }
}

async function loadProfile() {
  try {
    const userId = route.params.id || userStore.user?.id
    if (!userId) return

    followCounts.value = await userStore.fetchFollowCounts(userId)
  } catch (err) {
    console.error('Error loading profile:', err)
  }
}

async function loadUserContent() {
  try {
    const userId = route.params.id || userStore.user?.id
    if (!userId) return

    // 게시물 로드
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 각 게시물의 프로필, 좋아요, 댓글 수를 가져오기
    const postsWithAll = await Promise.all(
      (postsData || []).map(async (post) => {
        // 프로필 정보 가져오기
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', post.user_id)
          .single()

        // 좋아요 수와 상태 가져오기
        const { count: likeCount } = await supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id)

        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', userStore.user?.id)
          .maybeSingle()

        // 댓글 수 가져오기
        const { count: commentCount } = await supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id)

        return {
          ...post,
          profiles: profileData,
          likeCount: likeCount || 0,
          commentCount: commentCount || 0,
          liked: !!likeData,
        }
      }),
    )

    userPosts.value = postsWithAll

    // 답글 로드
    const { data: repliesData } = await supabase
      .from('comments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 각 답글의 프로필과 원본 게시물 정보 가져오기
    const repliesWithAll = await Promise.all(
      (repliesData || []).map(async (reply) => {
        // 답글 작성자 프로필
        const { data: replyProfile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', reply.user_id)
          .single()

        // 원본 게시물과 작성자 정보
        const { data: post } = await supabase
          .from('posts')
          .select('*')
          .eq('id', reply.post_id)
          .single()

        const { data: postProfile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', post.user_id)
          .single()

        return {
          id: reply.id,
          content: reply.content,
          created_at: reply.created_at,
          user_id: reply.user_id,
          profiles: replyProfile,
          parent_post: {
            ...post,
            profiles: postProfile,
          },
          isReply: true,
          commentCount: 0,
          likeCount: 0,
          liked: false,
        }
      }),
    )

    userReplies.value = repliesWithAll
    userReposts.value = []
  } catch (err) {
    console.error('Error loading user content:', err)
    $q.notify({
      type: 'negative',
      message: '컨텐츠를 불러오는데 실패했습니다.',
    })
  }
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

// 아바타 변경 다이얼로그 열기
function openAvatarDialog() {
  if (!isCurrentUser.value) return
  showAvatarDialog.value = true
}

// 파일 선택 다이얼로그 열기
function selectImage() {
  fileInput.value.click()
}

// 아바타 저장
async function saveAvatar() {
  if (!selectedFile.value) return

  uploading.value = true
  try {
    // 이전 아바타 이미지 삭제 (기본 아바타가 아닌 경우만)
    if (profileStore.profile.avatar_url && !profileStore.profile.avatar_url.includes('dicebear')) {
      const oldPath = profileStore.profile.avatar_url.split('/').pop()
      await supabase.storage.from('avatars').remove([oldPath])
    }

    // 새 아바타 이미지 업로드
    const fileExt = selectedFile.value.name.split('.').pop()
    const fileName = `${userStore.user.id}_${Date.now()}.${fileExt}`

    // 이미지 리사이징
    const resizedImage = await resizeImage(selectedFile.value, 400, 400)

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, resizedImage, {
        cacheControl: '3600',
        upsert: false,
        contentType: `image/${fileExt}`,
      })

    if (uploadError) throw uploadError

    // 공개 URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(fileName)

    // 프로필 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userStore.user.id)

    if (updateError) throw updateError

    // 프로필 다시 로드
    await profileStore.fetchProfile(userStore.user.id)

    $q.notify({
      type: 'positive',
      message: '프로필 이미지가 업데이트되었습니다.',
    })

    showAvatarDialog.value = false
  } catch (err) {
    console.error('Error updating avatar:', err)
    $q.notify({
      type: 'negative',
      message: err.message || '프로필 이미지 업데이트에 실패했습니다.',
    })
  } finally {
    uploading.value = false
    selectedFile.value = null
    avatarPreview.value = null
  }
}

// 이미지 리사이징 함수
async function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // 비율 유지하면서 크기 조정
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 이미지를 Blob으로 변환
        canvas.toBlob((blob) => {
          resolve(blob)
        }, file.type)
      }
    }
  })
}

// 파일 선택 시 처리
function onFileSelected(event) {
  const file = event.target.files[0]
  if (!file) return

  // 파일 타입 체크
  if (!file.type.startsWith('image/')) {
    $q.notify({
      type: 'negative',
      message: '이미지 파일만 업로드할 수 있습니다.',
    })
    return
  }

  // 파일 크기 체크 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    $q.notify({
      type: 'negative',
      message: '파일 크기는 5MB를 초과할 수 없습니다.',
    })
    return
  }

  selectedFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}
</script>

<style lang="scss" scoped>
.profile-modal {
  width: 400px;
  max-width: 95vw;
  border-radius: 16px;
}

.q-tab-panels {
  background: transparent;
}
</style>
