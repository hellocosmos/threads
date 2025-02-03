<template>
  <q-page class="q-pa-md">
    <q-card flat bordered>
      <q-card-section>
        <q-input
          v-model="content"
          type="textarea"
          placeholder="무슨 생각을 하고 계신가요?"
          autogrow
          :rules="[(val) => !!val || '내용을 입력해주세요']"
        />
      </q-card-section>

      <q-card-section v-if="imagePreview">
        <q-img :src="imagePreview" style="max-height: 200px; object-fit: cover">
          <div class="absolute-top-right">
            <q-btn round flat icon="close" size="sm" color="white" @click="clearImage" />
          </div>
        </q-img>
      </q-card-section>

      <q-card-actions align="between">
        <q-btn flat round color="grey" icon="image" @click="triggerImageUpload">
          <input
            type="file"
            ref="fileInput"
            style="display: none"
            accept="image/*"
            @change="onImageSelected"
          />
        </q-btn>
        <q-btn
          :loading="postsStore.loading"
          :disable="!content.trim()"
          color="primary"
          label="게시하기"
          @click="createPost"
        />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePostsStore } from 'stores/posts'
import { useQuasar } from 'quasar'

const router = useRouter()
const postsStore = usePostsStore()
const $q = useQuasar()

const content = ref('')
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInput = ref(null)

function triggerImageUpload() {
  fileInput.value.click()
}

function onImageSelected(event) {
  const file = event.target.files[0]
  if (file) {
    imageFile.value = file
    imagePreview.value = URL.createObjectURL(file)
  }
}

function clearImage() {
  imageFile.value = null
  imagePreview.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function createPost() {
  try {
    await postsStore.createPost({
      content: content.value,
      imageFile: imageFile.value,
    })

    $q.notify({
      type: 'positive',
      message: '게시물이 작성되었습니다.',
    })

    router.push('/')
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.message || '게시물 작성에 실패했습니다.',
    })
  }
}
</script>
