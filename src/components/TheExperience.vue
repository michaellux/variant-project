<script setup lang="ts">
import { TresCanvas, useRenderLoop } from '@tresjs/core';
import { reactive, shallowRef } from 'vue';
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Vector3 } from 'three';
import { OrbitControls } from '@tresjs/cientos';
import { TresLeches, useControls } from '@tresjs/leches';
import '@tresjs/leches/styles';

const gl = reactive({
  clearColor: '#82DBC5',
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
});

const { value: position } = useControls({
  position: new Vector3(0, 0, 0),
});
</script>

<template>
  <TresLeches />
  <TresCanvas v-bind="gl">
    <TresPerspectiveCamera :position="[5, 5, 5]" />
    <OrbitControls />
    <TresAmbientLight :intensity="0.5" :color="'red'" />
    <!-- this doesn't seem to be working, I must be doing it wrong -->
    <TresMesh :position="position">
      <!-- the only way it works locally is -->
      <!-- <TresMesh :position-x="position.x" :position-y="position.y" :position-z="position.z" -->
      <TresBoxGeometry :args="[1, 1, 1]" />
      <TresMeshNormalMaterial />
    </TresMesh>
    <TresDirectionalLight :position="[0, 2, 4]" :intensity="1" cast-shadow />
    <TresAxesHelper />
    <TresGridHelper :args="[10, 10, 0x444444, 'teal']" />
  </TresCanvas>
</template>
