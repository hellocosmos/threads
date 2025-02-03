<template>
  <q-page class="row">
    <!-- 왼쪽 소개 섹션 -->
    <div class="col-12 col-md-6 bg-black text-white flex flex-center">
      <div class="text-center q-pa-xl">
        <q-icon name="forum" size="100px" class="q-mb-lg" />
        <div class="text-h3 q-mb-md">Threads</div>
        <div class="text-h6 q-mb-xl">생각을 나누고 이야기를 연결하세요</div>
        <!-- <div class="text-body1 q-mb-md">• 실시간으로 다른 사람들과 소통하세요</div>
        <div class="text-body1 q-mb-md">• 관심사를 공유하고 새로운 인사이트를 얻으세요</div>
        <div class="text-body1">• 당신의 이야기로 새로운 연결을 만드세요</div> -->
      </div>
    </div>

    <!-- 오른쪽 로그인 섹션 -->
    <div class="col-12 col-md-6 flex flex-center">
      <q-card class="login-card" flat bordered>
        <q-card-section>
          <div class="text-h4 text-center q-mb-xl">시작하기</div>
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
              v-model="password"
              label="비밀번호"
              type="password"
              outlined
              autocomplete="current-password"
              :rules="[(val) => !!val || '비밀번호를 입력해주세요']"
            />
            <div class="q-mt-lg">
              <q-btn
                label="로그인"
                type="submit"
                color="black"
                class="full-width"
                size="large"
                :loading="userStore.loading"
              />
            </div>
          </q-form>
          <div class="text-center q-mt-lg text-body1">
            아직 계정이 없으신가요?
            <router-link to="/auth/register" class="text-black">회원가입</router-link>
          </div>
        </q-card-section>
      </q-card>
    </div>
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

async function onSubmit() {
  try {
    await userStore.login(email.value, password.value)
    router.push('/')
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.message,
    })
  }
}
</script>

<style lang="scss" scoped>
.login-card {
  width: 400px;
  max-width: 90%;
  padding: 40px;
}

@media (max-width: 1023px) {
  .col-md-6 {
    height: 50vh;
  }
}
</style>
