<script setup lang="ts">
import { TresCanvas, extend } from "@tresjs/core";
import { ref, reactive, shallowRef, onMounted } from "vue";
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Vector3 } from "three";
import { OrbitControls, Stats, vLog } from "@tresjs/cientos";
import { Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
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

const groupRef: ShallowRef<TresInstance | null> = shallowRef(null)

const handleAddMesh = () => {
  console.log('add Mesh');
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0x00ff00 });
  const meshWithMaterial = new Mesh(geometry, material);
  groupRef.value.children = [...groupRef.value.children, meshWithMaterial];
  console.log(groupRef.value);
}
</script>

<template>
  <TheControlPanel @addmesh="handleAddMesh" />
  <TresCanvas v-bind="gl" preset="realistic">
    <Stats style="
    left: 1.5rem;
    top: 1.5rem;"/>
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
  <TresGroup ref="groupRef" v-log></TresGroup>
  </TresCanvas>
</template>
