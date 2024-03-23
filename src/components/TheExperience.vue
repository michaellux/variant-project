<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { watchEffect, reactive, shallowReactive, shallowRef, onMounted, onUnmounted } from "vue";
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Vector3 } from "three";
import { OrbitControls, TransformControls, Stats, vLog, useGLTF } from "@tresjs/cientos";
import { Raycaster, Vector2 } from "three";
import sources from "../sources";
import GUI, { Controller } from 'lil-gui';
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
let gui = null;
let positionFolder = null;



const transformState = shallowReactive({
  showX: true,
  showY: true,
  showZ: true,
});

const handleAddMesh = async (meshValue) => {
  if (meshValue !== "Не выбран") {
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
        choosenMeshRef.value = choosenMesh;
        if (positionFolder === null) {
            positionFolder = gui.addFolder('Position');
            positionFolder.add(choosenMeshRef.value.position, 'x').min(-10).max(10).step(0.01).listen();
            positionFolder.add(choosenMeshRef.value.position, 'y').min(-10).max(10).step(0.01).listen();
            positionFolder.add(choosenMeshRef.value.position, 'z').min(-10).max(10).step(0.01).listen();
        }
        else {
            console.log(positionFolder.controllers);
            console.log(choosenMeshRef.value);
            positionFolder.controllers.forEach(controller => {
              controller.object = choosenMeshRef.value.position;
            });
        }
        break;
      }
    }
  }
};

onMounted(() => {
  gui = new GUI();

  const meshes = sources
      .filter((source) => source.type === "model")
      .map((source) => source.name);
  const controlValues = {
    mesh: 'Не выбран',
    addMesh: function() {
      handleAddMesh(this.mesh)
    }
  }
  gui.add(controlValues, "mesh", meshes);
  gui.add(controlValues, "addMesh");
  document.addEventListener("mousedown", handleMouseDown, false);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleMouseDown, false);
});
</script>

<template>
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
