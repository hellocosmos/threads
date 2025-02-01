import { route } from 'quasar/wrappers'
import { createRouter, createWebHistory } from 'vue-router'
import routes from './routes'
import useSupabase from 'boot/supabase'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function () {
  const { supabase } = useSupabase()

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createWebHistory(process.env.VUE_ROUTER_BASE),
  })

  Router.beforeEach(async (to, from, next) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (to.matched.some((record) => record.meta.requiresAuth)) {
      if (!session) {
        next('/auth/login')
      } else {
        next()
      }
    } else {
      next()
    }
  })

  return Router
})
