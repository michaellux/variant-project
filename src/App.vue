<script setup lang="ts">
import TheExperience from './components/TheExperience.vue'
import { useControls, TresLeches } from '@tresjs/leches'
import '../leches.css'

useControls('fpsgraph')
</script>

<template>
  <TresLeches style='left: 1.5rem; top: 1.5rem;'/>
  <TheExperience />
</template>
