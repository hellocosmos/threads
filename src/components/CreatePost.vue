<script setup>
import { ref, onMounted } from 'vue'
import { usePostsStore } from 'stores/posts'
import { useQuasar } from 'quasar'

const props = defineProps({
  initialPost: {
    type: Object,
    default: null,
  },
  isEdit: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'post-created', 'post-updated'])
const postsStore = usePostsStore()
const $q = useQuasar()

// refs 정의
const postContent = ref('')
const selectedImage = ref(null)
const imagePreview = ref(null)
const loading = ref(false)
const fileInput = ref(null)

// 수정 모드일 때 초기값 설정
onMounted(() => {
  if (props.isEdit && props.initialPost) {
    // 기존 내용을 postContent에 설정
    postContent.value = props.initialPost.content || ''

    // 기존 이미지가 있으면 이미지 미리보기에 설정
    if (props.initialPost.image_url) {
      imagePreview.value = props.initialPost.image_url
    }
  }
})

async function handleSubmit() {
  if (!postContent.value.trim()) return

  loading.value = true
  try {
    if (props.isEdit) {
      // 수정 모드
      const updatedPost = await postsStore.updatePost({
        postId: props.initialPost.id,
        content: postContent.value,
        imageFile: selectedImage.value,
        removeImage: !selectedImage.value && !imagePreview.value,
      })
      emit('post-updated', updatedPost)
    } else {
      // 생성 모드
      const newPost = await postsStore.createPost({
        content: postContent.value,
        imageFile: selectedImage.value,
      })
      emit('post-created', newPost)
    }

    // 입력 필드 초기화
    postContent.value = ''
    selectedImage.value = null
    imagePreview.value = null
    emit('close')
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '게시물 처리 중 오류가 발생했습니다.',
    })
  } finally {
    loading.value = false
  }
}

// 이미지 관련 함수들
function selectImage() {
  fileInput.value.$el.click()
}

function onImageSelected(file) {
  if (file) {
    // 이전 이미지 URL 해제
    if (imagePreview.value && imagePreview.value !== props.initialPost?.image_url) {
      URL.revokeObjectURL(imagePreview.value)
    }

    selectedImage.value = file
    imagePreview.value = URL.createObjectURL(file)
  }
}

function removeImage() {
  selectedImage.value = null

  // 이전 URL 해제
  if (imagePreview.value && imagePreview.value !== props.initialPost?.image_url) {
    URL.revokeObjectURL(imagePreview.value)
  }

  // 수정 모드에서는 원래 이미지로 복원, 아니면 null
  imagePreview.value = props.initialPost?.image_url || null
}
</script>

<template>
  <q-card class="create-post-card">
    <q-card-section class="row items-center q-pb-none">
      <div class="text-h6">{{ isEdit ? '게시물 수정' : '새 게시물 작성' }}</div>
      <q-space />
      <q-btn icon="close" flat round dense v-close-popup @click="$emit('close')" />
    </q-card-section>

    <q-card-section>
      <!-- 텍스트 입력 영역 - v-model만 사용 -->
      <q-input
        v-model="postContent"
        type="textarea"
        autogrow
        outlined
        placeholder="무슨 일이 일어나고 있나요?"
      />

      <!-- 이미지 업로드 영역 -->
      <div class="q-mt-md">
        <!-- 이미지 미리보기 -->
        <div v-if="imagePreview" class="q-mb-sm">
          <q-img
            :src="imagePreview"
            style="max-height: 200px; object-fit: contain"
            class="rounded-borders cursor-pointer"
            @click="selectImage"
          >
            <div class="absolute-full flex flex-center">
              <q-btn round flat dense color="grey-8" icon="photo_camera" class="change-image-btn">
                <q-tooltip>클릭하여 이미지 변경</q-tooltip>
              </q-btn>
            </div>
            <div class="absolute-top-right">
              <q-btn round flat dense icon="close" color="grey-8" @click.stop="removeImage" />
            </div>
          </q-img>
        </div>

        <!-- 숨겨진 파일 입력 -->
        <q-file
          v-model="selectedImage"
          accept="image/*"
          @update:model-value="onImageSelected"
          style="display: none"
          ref="fileInput"
        />

        <!-- 이미지가 없을 때만 이미지 추가 버튼 표시 -->
        <q-btn
          v-if="!imagePreview"
          class="q-mt-sm"
          icon="add_photo_alternate"
          label="이미지 추가"
          @click="selectImage"
        />
      </div>
    </q-card-section>

    <q-card-actions align="right">
      <q-btn flat label="취소" color="primary" v-close-popup @click="$emit('close')" />
      <q-btn
        flat
        :label="isEdit ? '수정' : '게시'"
        color="primary"
        @click="handleSubmit"
        :loading="loading"
        :disable="!postContent.trim()"
      />
    </q-card-actions>
  </q-card>
</template>

<style scoped>
.create-post-card {
  border-radius: 12px;
}

.q-img {
  background-color: #f5f5f5;
  transition: all 0.3s ease;

  &:hover {
    .change-image-btn {
      opacity: 1;
    }
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
    }
  }
}

.change-image-btn {
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
  background: rgba(255, 255, 255, 0.8) !important;
}
</style>
