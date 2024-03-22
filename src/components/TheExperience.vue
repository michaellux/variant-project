<script setup lang="ts">
import { TresCanvas, extend } from "@tresjs/core";
import { ref, reactive, shallowReactive, shallowRef, onMounted, onUnmounted } from "vue";
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Vector3 } from "three";
import { OrbitControls, TransformControls, Stats, vLog, useGLTF } from "@tresjs/cientos";
import { Raycaster, Vector2 } from "three";
import TheControlPanel from "./TheControlPanel.vue";
import sources from "../sources";
import "@tresjs/leches/styles";

const gl = reactive({
  clearColor: "#b9b9b4",
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
});

const cameraRef: ShallowRef<TresInstance | null> = shallowRef(null);
const canvasRef: ShallowRef<TresInstance | null> = shallowRef(null);
const groupRef: ShallowRef<TresInstance | null> = shallowRef(null);
const choosenMeshRef: ShallowRef<TresInstance | null> = shallowRef(null);
let context = null;
let choosenMesh = ref(null);

const transformState = shallowReactive({
  showX: true,
  showY: true,
  showZ: true,
});

const handleAddMesh = async (meshValue: string) => {
  if (meshValue !== "") {
    console.log("add Mesh");
    const modelFile = sources.find(
      (source) => source.type === "model" && source.name === meshValue
    )?.path;
    if (!modelFile) {
      console.error("Model file not found");
      return;
    }
    const downloadModel = await useGLTF(modelFile, {
      binary: true,
    });
    const meshName = downloadModel.scene.children[0].name;
    downloadModel.scene.children[0].name = `${meshName}_inScene`;
    if (groupRef.value) {
      groupRef.value.children = [
        ...groupRef.value.children,
        downloadModel.scene,
      ];
      console.log(groupRef.value);
    } else {
      console.error("groupRef is not initialized");
    }
  } else {
    alert("Не выбрана геометрия!");
  }
};

const raycaster = new Raycaster();
const mouse = new Vector2();

const handleMouseDown = (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, cameraRef.value);

  context = canvasRef.value.context;

  const intersects = raycaster.intersectObjects(
    context.scene.value.children,
    true
  );

  if (intersects.length > 0) {
    console.log("Выбрано", intersects);

    for (const intersect of intersects) {
      if (intersect.object.type === "Mesh" && intersect.object.name.endsWith("inScene")) {
        let choosenMesh = intersect.object;
        console.log("Mesh выбран");
        console.log("choosenMesh", choosenMesh);
        console.log("type", choosenMesh.parent?.type);
        //intersect.object.material.color.setHex(Math.random() * 0xffffff);
        choosenMeshRef.value = choosenMesh;
        break;
      }
    }
  }
};

onMounted(() => {
  console.log(cameraRef);
  console.log(canvasRef.value.context);
  document.addEventListener("mousedown", handleMouseDown, false);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleMouseDown, false);
});
</script>

<template>
  <TheControlPanel @addmesh="handleAddMesh" />
  <TresCanvas ref="canvasRef" v-bind="gl" preset="realistic">
    <Stats style="left: 1.5rem; top: 1.5rem" />
    <TresPerspectiveCamera
      ref="cameraRef"
      :position="[1, 1, 1]"
      :fov="75"
      :near="0.1"
      :far="1000"
      look-at="[0, 0, 0]"
    />
    <OrbitControls make-default/>
    <TransformControls v-log v-if="choosenMeshRef" :object="choosenMeshRef" v-bind="transformState" />
    <TresAmbientLight :intensity="0.5" :color="'red'" />

    <TresDirectionalLight :position="[0, 2, 4]" :intensity="1" cast-shadow />
    <TresGridHelper :args="[500, 50]" />
    <TresAxesHelper :args="[100]" />
    <TresGroup ref="groupRef" v-log>
    </TresGroup>
  </TresCanvas>
</template>
