<template>
  <q-page class="flex flex-center">
    <q-card class="register-card">
      <q-card-section>
        <div class="text-h6 text-center q-mb-md">회원가입</div>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input
            v-model="email"
            label="이메일"
            type="email"
            outlined
            autocomplete="email"
            :rules="[(val) => !!val || '이메일을 입력해주세요']"
          />
          <q-input
            v-model="username"
            label="사용자 이름"
            outlined
            autocomplete="username"
            :rules="[(val) => !!val || '사용자 이름을 입력해주세요']"
          />
          <q-input
            v-model="password"
            label="비밀번호"
            type="password"
            outlined
            autocomplete="new-password"
            :rules="[
              (val) => !!val || '비밀번호를 입력해주세요',
              (val) => val.length >= 6 || '비밀번호는 최소 6자 이상이어야 합니다',
            ]"
          />
          <q-input
            v-model="confirmPassword"
            label="비밀번호 확인"
            type="password"
            outlined
            autocomplete="new-password"
            :rules="[
              (val) => !!val || '비밀번호를 다시 입력해주세요.',
              (val) => val === password || '비밀번호가 일치하지 않습니다.',
            ]"
          />
          <div>
            <q-btn
              label="회원가입"
              type="submit"
              color="primary"
              class="full-width"
              :loading="userStore.loading"
            />
          </div>
        </q-form>
        <div class="text-center q-mt-sm">
          이미 계정이 있으신가요?
          <router-link to="/auth/login" class="text-primary">로그인</router-link>
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from 'stores/user'
import { useQuasar } from 'quasar'

const router = useRouter()
const userStore = useUserStore()
const $q = useQuasar()

const email = ref('')
const password = ref('')
const username = ref('')
const confirmPassword = ref('')

async function onSubmit() {
  try {
    console.log('Starting registration...', { email: email.value, username: username.value }) // 디버깅 로그

    if (password.value !== confirmPassword.value) {
      $q.notify({
        type: 'negative',
        message: '비밀번호가 일치하지 않습니다.',
      })
      return
    }

    const success = await userStore.register(email.value, password.value, username.value)
    console.log('Registration result:', success) // 디버깅 로그

    if (success) {
      $q.notify({
        type: 'positive',
        message: '회원가입이 완료되었습니다.',
        timeout: 2000,
      })
      router.push('/')
    } else {
      throw new Error(userStore.error || '회원가입에 실패했습니다.')
    }
  } catch (error) {
    console.error('Registration error in component:', error) // 디버깅 로그
    $q.notify({
      type: 'negative',
      message: error.message || '회원가입 중 오류가 발생했습니다.',
      timeout: 2000,
    })
  }
}
</script>

<style lang="scss" scoped>
.register-card {
  width: 100%;
  max-width: 400px;
  padding: 20px;
}
</style>
