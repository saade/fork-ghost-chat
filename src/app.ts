import messages from '@intlify/unplugin-vue-i18n/messages';
import ElectronStore from 'electron-store';
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHashHistory } from 'vue-router/auto';

import IpcHandler from '@lib/ipchandler';

import App from './App.vue';

import './assets/css/index.css';

const router = createRouter({
    history: createWebHashHistory(),
});

IpcHandler.getGeneral()
    .then((general) => {
        const i18n = createI18n<false>({
            locale: general.language,
            fallbackLocale: 'en-US',
            messages,
            legacy: false,
        });

        createApp(App)
            .use(router)
            .use(i18n)
            // FIXME: remove after all `inject` calls are removed
            .provide('electronStore', new ElectronStore())
            .mount('#app');
    })
    .catch((error) => {
        console.error(error);
    });
