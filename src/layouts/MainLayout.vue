<template>
  <q-layout view="hHh lpR fFf">
    <q-header bordered>
      <q-toolbar>
        <q-toolbar-title class="text-center">
          <div class="text-h6">Threads</div>
        </q-toolbar-title>
        <q-btn flat round icon="logout" @click="handleLogout" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </q-page-container>

    <!-- 하단 메뉴 -->
    <q-footer bordered class="bg-black text-white">
      <q-tabs
        v-model="tab"
        class="text-white"
        active-color="white"
        indicator-color="transparent"
        no-caps
        align="justify"
      >
        <q-route-tab name="home" to="/" icon="home" label="홈" />
        <q-route-tab name="search" to="/search" icon="search" label="검색" />
        <q-route-tab name="create" to="/create" icon="add_box" label="작성" />
        <q-route-tab name="activity" to="/activity" icon="notifications" label="활동" />
        <q-route-tab
          name="profile"
          :to="`/profile/${userStore.user?.id}`"
          icon="person"
          label="프로필"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from 'stores/user'
import { useQuasar } from 'quasar'

const userStore = useUserStore()
const tab = ref('home')
const $q = useQuasar()

async function handleLogout() {
  try {
    await userStore.logout()
    $q.notify({
      type: 'positive',
      message: '로그아웃되었습니다.',
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || '로그아웃 중 오류가 발생했습니다.',
    })
  }
}
</script>

<style lang="scss" scoped>
.q-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.q-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.12);

  .q-tabs {
    height: 60px;
  }

  .q-tab {
    .q-tab__content {
      flex-direction: column;
      min-height: 50px;
      padding: 4px 0;

      .q-tab__icon {
        font-size: 24px;
        margin-bottom: 2px;
      }

      .q-tab__label {
        font-size: 12px;
      }
    }
  }
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .q-footer {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
