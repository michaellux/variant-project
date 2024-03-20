<script setup lang="ts">
import { TresCanvas, useRenderLoop } from "@tresjs/core";
import { reactive, shallowRef } from "vue";
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Vector3 } from "three";
import { OrbitControls } from "@tresjs/cientos";
import TheControlPanel from "./TheControlPanel.vue";
import "@tresjs/leches/styles";

const gl = reactive({
  clearColor: "#b9b9b4",
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
});
</script>

<template>
  <TheControlPanel />
  <TresCanvas v-bind="gl">
    <TresPerspectiveCamera
      :position="[-20, 10, 20]"
      :fov="75"
      :near="0.1"
      :far="1000"
      look-at="[0, 0, 0]"
    />
    <OrbitControls />
    <TresAmbientLight :intensity="0.5" :color="'red'" />

    <TresDirectionalLight :position="[0, 2, 4]" :intensity="1" cast-shadow />
    <TresGridHelper :args="[500, 50]" />
    <TresAxesHelper :args="[100]" />
  </TresCanvas>
</template>
