<script setup lang="ts">
import { TresCanvas, useTexture } from "@tresjs/core";
import { watchEffect, reactive, shallowReactive, shallowRef, onMounted, onUnmounted } from "vue";
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Vector3 } from "three";
import { OrbitControls, TransformControls, Stats, vLog, useGLTF } from "@tresjs/cientos";
import { Raycaster, Vector2, MeshPhysicalMaterial } from "three";
import sources from "../sources";
import GUI, { Controller } from 'lil-gui';

import TexturedBall from './TexturedBall.vue';
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
let textureFolder = null;
const notChoosetext = "Не выбрано";

// const pbrTexture = await useTexture({
//   map: 'textures/albedo/albedo-wood.png',
// })


const transformState = shallowReactive({
  showX: true,
  showY: true,
  showZ: true,
});

const handleAddMesh = async (meshValue: string) => {
  if (meshValue !== notChoosetext) {
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
    let meshName = downloadModel.scene.children[0].name;
    downloadModel.scene.children[0].name = `${meshName}_inScene`;
    downloadModel.scene.name = `${meshName}_inScene`;
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

const handleApplyTexture = async (textureSubtypeName: string) => {
  if (textureSubtypeName !== notChoosetext) {
    const textureFile = sources.find(
      (source) => source.type === "texture" && source.name === textureSubtypeName
    )?.path;
    if (!textureFile) {
      console.error("Texture file not found");
      return;
    }
    const downloadTexture = await useTexture({
       map: textureFile,
    });
    console.log("texture", downloadTexture);
    console.log("choosenMeshRef",choosenMeshRef.value);
    const newMaterial = new MeshPhysicalMaterial();
    const oldMaterial = choosenMeshRef.value.material;
    
    choosenMeshRef.value.material = newMaterial; // применяем свежий материал
    choosenMeshRef.value.material.map = downloadTexture.map;
    choosenMeshRef.value.material.attenuationColor = oldMaterial.attenuationColor;
    choosenMeshRef.value.material.clearcoatNormalScale = oldMaterial.clearcoatNormalScale;
    choosenMeshRef.value.material.color = oldMaterial.color;
    choosenMeshRef.value.material.defines = oldMaterial.defines;
    choosenMeshRef.value.material.emissive = oldMaterial.emissive;
    choosenMeshRef.value.material.ior = oldMaterial.ior;
    choosenMeshRef.value.material.iridescenceThicknessRange = oldMaterial.iridescenceThicknessRange;
    choosenMeshRef.value.material.metalness = oldMaterial.metalness;
    choosenMeshRef.value.material.normalScale = oldMaterial.normalScale;
    choosenMeshRef.value.material.roughness = oldMaterial.roughness;
    choosenMeshRef.value.material.sheenColor = oldMaterial.sheenColor;
    choosenMeshRef.value.material.side = oldMaterial.side;
    choosenMeshRef.value.material.specularColor = oldMaterial.specularColor;
    choosenMeshRef.value.material.specularIntensity = oldMaterial.specularIntensity;
function compareObjects(obj1, obj2) {
    const keys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)]));
    const diff = Object.entries({...obj1, ...obj2}).filter(([key]) => obj1[key] !== obj2[key]);
    return Object.fromEntries(diff);
}


    console.log(compareObjects(oldMaterial, choosenMeshRef.value.material));

    //choosenMeshRef.value.material.color.setHex(0xffff00);
    console.log("choosenMeshRef - после применения",choosenMeshRef.value);
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

    const findRootGroupOfMesh = (intersectMesh) => {
      let currentNode = intersectMesh.parent;
      while (!currentNode.isGroup) {
        currentNode = currentNode.parent;
      }
      if (currentNode.name.endsWith("_inScene")) {
        return currentNode;
      }
      return null;
    }

    for (const intersect of intersects) {
      const intersectType = intersect.object.type;
      const intersectMesh = intersect.object;
      let rootGroupOfMesh = null;
      if (intersectType === "Mesh") {
        rootGroupOfMesh = findRootGroupOfMesh(intersectMesh);
      }
      if (rootGroupOfMesh !== null) {
        let choosenMesh = rootGroupOfMesh.children[0];
        console.log("choosenMesh", choosenMesh);
        choosenMeshRef.value = choosenMesh;
        if (positionFolder === null) {
            positionFolder = gui.addFolder('Position');
            positionFolder.add(choosenMeshRef.value.position, 'x').min(-10).max(10).step(0.01).listen();
            positionFolder.add(choosenMeshRef.value.position, 'y').min(-10).max(10).step(0.01).listen();
            positionFolder.add(choosenMeshRef.value.position, 'z').min(-10).max(10).step(0.01).listen();
        }
        if (textureFolder === null) {
          textureFolder = gui.addFolder('Textures');
          let textures = sources
          .filter((source) => source.type === "texture");
          let textureSubTypeNames = new Set(textures.map((texture) => texture.subtype));
          let controls = {};
          textureSubTypeNames.forEach((subtype) => {
            controls[subtype] = notChoosetext;
          });
          textureSubTypeNames.forEach((subtype) => {
           textureFolder?.add(controls, subtype, textures
              .filter((source) => source.subtype === subtype)
              .map((source) => source.name)
              )
            .onChange(event => {
              console.log(event);
              handleApplyTexture(event)
          })
          })
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
    mesh: notChoosetext,
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
       <!-- <Suspense>
          <TexturedBall />
       </Suspense> -->
    </TresGroup>
  </TresCanvas>
</template>
