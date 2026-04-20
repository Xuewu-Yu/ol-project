import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'mapEdit',
            component: () => import('../views/MapEdit.vue'),
        },
        {
            path: '/mapScreen',
            name: 'mapScreen',
            component: () => import('../views/MapScreen.vue'),
        }
    ]
})