import type { App, ComponentOptions } from 'vue'
import { createApp } from 'vue'
import './style.css'
import Application from './App.vue'

const app: App<Element> = createApp(Application as ComponentOptions)
app.mount('#app')
