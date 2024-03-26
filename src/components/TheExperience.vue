<script setup lang="ts">
import { TresCanvas, useTexture } from "@tresjs/core";
import { watchEffect, reactive, shallowReactive, shallowRef, onMounted, onUnmounted } from "vue";
import { Mesh, BasicShadowMap, SRGBColorSpace, NoToneMapping, REVISION } from "three";
import { OrbitControls, TransformControls, Stats, vLog, useGLTF } from "@tresjs/cientos";
import { Raycaster, Vector2, RepeatWrapping, NearestMipmapNearestFilter } from "three";
import sources from "../sources";
import GUI, { Controller } from 'lil-gui';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
//import TexturedBall from './TexturedBall.vue';
//import TexturedCube from './TexturedCube.vue';
import Primitive from './Primitive.vue';
const gl = reactive({
  clearColor: "#b9b9b4",
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
});
const THREE_PATH = `https://unpkg.com/three@0.${REVISION}.x`;
const cameraRef: ShallowRef<TresInstance | null> = shallowRef(null);
const canvasRef: ShallowRef<TresInstance | null> = shallowRef(null);
const groupRef: ShallowRef<TresInstance | null> = shallowRef(null);
const choosenMeshRef: ShallowRef<TresInstance | null> = shallowRef(null);
let context = null;
let gui = null;
let positionFolder = null;
let textureFolder = null;
const notChoosetext = "Не выбрано";

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

    const textureInfo = {
      albedo: notChoosetext,
      roughness: notChoosetext,
      metalness: notChoosetext,
      normal: notChoosetext,
      sheen: notChoosetext
    };

    downloadModel.scene.children[0].name = `${meshName}_inScene|${JSON.stringify(textureInfo)}`;
    downloadModel.scene.name = `${meshName}_inScene`;
    console.log(downloadModel.scene.children[0].geometry);

    const remapUVs = (geo) => {
       geo.computeBoundingBox();
    var min = geo.boundingBox.min;
    var max = geo.boundingBox.max;
    var offset = new Vector2(0 - min.x, 0 - min.y);
    var size = new Vector2(max.x - min.x, max.y - min.y);

    // Получаем текущие UV-координаты
    var uvArray = geo.attributes.uv.array;

    // Пересчитываем UV-координаты для каждой вершины
    for (var i = 0; i < uvArray.length; i += 2) {
        // Получаем текущие UV-координаты
        var u = uvArray[i];
        var v = uvArray[i + 1];

        // Пересчитываем UV-координаты
        uvArray[i] = (u + offset.x) / size.x;
        uvArray[i + 1] = (v + offset.y) / size.y;
    }

    // Обновляем атрибут UV
    geo.attributes.uv.needsUpdate = true;
    };

    //remapUVs(downloadModel.scene.children[0].geometry);

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
  const modelMaterial = choosenMeshRef.value.material;
  const newMaterial = new modelMaterial.constructor();
  let finalTexture = {
    map: null,
    roughnessMap: null,
    metalnessMap: null,
    normalMap: null,
    // TODO Sheen
  };
  if (textureSubtypeName !== notChoosetext) {
    const applyTexture = (texture, subtype) => {
      const downloadedTexture = texture;
      if (!downloadedTexture.isCompressedTexture) {
          if (downloadedTexture.map !== null) {
            finalTexture.map = downloadedTexture.map;
          }
          if (downloadedTexture.roughnessMap !== null) {
            finalTexture.roughnessMap = downloadedTexture.roughnessMap;
          }
          if (downloadedTexture.metalnessMap !== null) {
            finalTexture.metalnessMap = downloadedTexture.metalnessMap;
          }
          if (downloadedTexture.normalMap !== null) {
            finalTexture.normalMap = downloadedTexture.normalMap;
          }
          // TODO Sheen
      } else {
          switch (subtype) {
            case "albedo":
              finalTexture.map = downloadedTexture;
              break;
            case "roughness":
              finalTexture.roughnessMap = downloadedTexture;
              break;
            case "metalness":
              finalTexture.metalnessMap = downloadedTexture;
              break;
            case "normal":
              finalTexture.normalMap = downloadedTexture;
              break;
              // TODO Sheen
            default:
              break;
          }
      }
    }

    const getTexture = (textureSubtypeName) => {
      if (textureSubtypeName !== notChoosetext) {
        return sources.find(
          (source) => source.type === "texture" && source.name === textureSubtypeName
        );
      }
      return null;
    } 
    const texture = {
      path: getTexture(textureSubtypeName) !== null ? getTexture(textureSubtypeName)?.path : null,
      subtype: getTexture(textureSubtypeName) !== null ? getTexture(textureSubtypeName)?.subtype : null
    }
    if (!texture) {
      console.error("Texture file not found");
      return;
    }
    let downloadTexture = null;
    const meshNameArr = choosenMeshRef.value.name.split("|");
    const textureInfo = JSON.parse(meshNameArr[1]);

    let albedoTexture = { 
      path: getTexture(textureInfo.albedo) !== null ? getTexture(textureInfo.albedo)?.path : null,
      subtype: getTexture(textureInfo.albedo) !== null ? getTexture(textureInfo.albedo)?.subtype : null
    };
    let roughnessTexture = {
      path: getTexture(textureInfo.roughness) !== null ? getTexture(textureInfo.roughness)?.path : null,
      subtype: getTexture(textureInfo.roughness) ? getTexture(textureInfo.roughness)?.subtype : null
    };
    let metalnessTexture = {
      path: getTexture(textureInfo.metalness) !== null ? getTexture(textureInfo.metalness)?.path : null,
      subtype: getTexture(textureInfo.metalness) !== null ? getTexture(textureInfo.metalness)?.subtype : null
    }
    let normalTexture = {
      path: getTexture(textureInfo.normal) !== null ? getTexture(textureInfo.normal)?.path : null,
      subtype: getTexture(textureInfo.normal) !== null ? getTexture(textureInfo.normal)?.subtype : null
    }

    //TODO sheen

    let downloadTextureOptions = {
      map: !albedoTexture.path?.endsWith(".ktx2") ? albedoTexture?.path : null,
      roughnessMap: !roughnessTexture.path?.endsWith(".ktx2") ? roughnessTexture?.path : null,
      metalnessMap: !metalnessTexture.path?.endsWith(".ktx2") ? metalnessTexture?.path : null,
      normalMap: !normalTexture.path?.endsWith(".ktx2") ? normalTexture?.path : null,
      //sheen
    };
    if (!texture?.path.endsWith(".ktx2")) {
      const textureSubtype = getTexture(textureSubtypeName)?.subtype;
      switch (textureSubtype) {
        case "albedo":
          downloadTextureOptions.map = texture?.path;
          break;
        case "roughness":
          downloadTextureOptions.roughnessMap = texture?.path;
          break;
        case "metalness":
          downloadTextureOptions.metalnessMap = texture?.path;
          break;
        case "normal":
          downloadTextureOptions.normalMap = texture?.path;
          break;
          //TODO Sheen
        default:
          break;
      }
    }

    downloadTexture = await useTexture(downloadTextureOptions);
    if (!Object.values(downloadTextureOptions).every(val => val === null)) {
      applyTexture(downloadTexture);
    }
    const ktx2Loader = new KTX2Loader()
    .setTranscoderPath(`${THREE_PATH}/examples/jsm/libs/basis/`)
    .detectSupport(context.renderer.value); 
    const loadKTXTexture = async (texturePath, textureSubtype) => {
      try {
        const texture = await ktx2Loader.loadAsync(texturePath);
        texture.minFilter = NearestMipmapNearestFilter;
        applyTexture(texture, textureSubtype);
      } catch (e) {
        console.error(e);
      }
    };
    if (texture?.path?.endsWith(".ktx2")) {
      await loadKTXTexture(texture?.path, texture?.subtype);
    }
    if (albedoTexture?.path?.endsWith(".ktx2")) {
      await loadKTXTexture(albedoTexture?.path, albedoTexture?.subtype);
    }
    if (roughnessTexture?.path?.endsWith(".ktx2")) {
      await loadKTXTexture(roughnessTexture?.path, roughnessTexture?.subtype);
    }
    if (metalnessTexture?.path?.endsWith(".ktx2")) {
      await loadKTXTexture(metalnessTexture?.path, metalnessTexture?.subtype);
    }
    if (normalTexture?.path?.endsWith(".ktx2")) {
      await loadKTXTexture(normalTexture?.path, normalTexture?.subtype);
    }
    //TODO Sheen

    choosenMeshRef.value.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = newMaterial; // применяем свежий материал
        if (finalTexture.map !== null) {
          child.material.map = finalTexture.map;
          child.material.map.wrapS = RepeatWrapping;
          child.material.map.wrapT = RepeatWrapping;
          child.material.map.x = 0.5
          child.material.map.y = 0.5
          child.material.map.rotation = Math.PI * 0.5
          child.material.map.needsUpdate = true;
        }
        if (finalTexture.roughnessMap !== null) {
          child.material.roughnessMap = finalTexture.roughnessMap;
          child.material.roughnessMap.wrapS = RepeatWrapping;
          child.material.roughnessMap.wrapT = RepeatWrapping;
          child.material.roughnessMap.x = 0.5
          child.material.roughnessMap.y = 0.5
          child.material.roughnessMap.rotation = Math.PI * 0.5
          child.material.roughnessMap.needsUpdate = true;
        }
        if (finalTexture.metalnessMap !== null) {
          child.material.metalnessMap = finalTexture.metalnessMap;
          child.material.metalnessMap.wrapS = RepeatWrapping;
          child.material.metalnessMap.wrapT = RepeatWrapping;
          child.material.metalnessMap.x = 0.5
          child.material.metalnessMap.y = 0.5
          child.material.metalnessMap.rotation = Math.PI * 0.5
          child.material.metalnessMap.needsUpdate = true;
        }
        if (finalTexture.normalMap !== null) {
          child.material.normalMap = finalTexture.normalMap;
          child.material.normalMap.wrapS = RepeatWrapping;
          child.material.normalMap.wrapT = RepeatWrapping;
          child.material.normalMap.x = 0.5
          child.material.normalMap.y = 0.5
          child.material.normalMap.rotation = Math.PI * 0.5
          child.material.normalMap.needsUpdate = true;
        }
          // TODO Sheen

        /*child.material.attenuationColor = modelMaterial.attenuationColor;
        child.material.clearcoatNormalScale = modelMaterial.clearcoatNormalScale;
      
        child.material.defines = modelMaterial.defines;
        child.material.emissive = modelMaterial.emissive;
        child.material.ior = modelMaterial.ior;
        child.material.iridescenceThicknessRange = modelMaterial.iridescenceThicknessRange;

        child.material.normalScale = modelMaterial.normalScale;
        child.material.roughness = modelMaterial.roughness;
        child.material.sheenColor = modelMaterial.sheenColor;
        child.material.side = modelMaterial.side;
        child.material.specularColor = modelMaterial.specularColor;
        child.material.specularIntensity = modelMaterial.specularIntensity

        child.material.metalness = modelMaterial.metalness; // если добавить будет "сильно" тёмная текстура
        child.material.color = modelMaterial.color; // если добавить будет "несильно" тёмная текстура*/
      }
    });
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
      console.log("currentNode" ,currentNode);
      while (currentNode?.isObject3D && !currentNode?.isGroup) {
        currentNode = currentNode.parent;
      }
      if (currentNode?.name.endsWith("_inScene")) {
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
            //const meshNameArr = choosenMeshRef.value.name.split("|");
            //const textureInfo = JSON.parse(meshNameArr[1]);
            //console.log(subtype);
            controls[subtype] = notChoosetext;
          });
          textureSubTypeNames.forEach((subtype) => {
           textureFolder?.add(controls, subtype, textures
              .filter((source) => source.subtype === subtype)
              .map((source) => source.name)
              )
            .onChange(event => {
              const meshNameArr = choosenMeshRef.value.name.split("|");
              const textureInfo = JSON.parse(meshNameArr[1]);
              console.log(subtype);
              textureInfo[subtype] = event;
              choosenMeshRef.value.name = [meshNameArr[0], JSON.stringify(textureInfo)].join("|");
              handleApplyTexture(event)
            })
            .listen()
          })
        }
        else {
            console.log(positionFolder.controllers);
            console.log(choosenMeshRef.value);
            positionFolder.controllers.forEach(controller => {
              controller.object = choosenMeshRef.value.position;
            });
            textureFolder.controllers.forEach(controller => {
              const meshNameArr = choosenMeshRef.value.name.split("|");
              const textureInfo = JSON.parse(meshNameArr[1]);
              controller.object = textureInfo;
            })
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
     <TresAmbientLight :intensity="0.5" />
   <TresDirectionalLight
      :position="[0, 2, 4]"
      :intensity="1"
      cast-shadow
    />
    <TresHemisphereLight
      color="0xffffff"
      :intensity="0.6"
    />
    <TresGridHelper :args="[500, 50]" />
    <TresAxesHelper :args="[100]" />
    <TresGroup ref="groupRef" v-log>
       <!-- <Suspense>
          <Primitive />
       </Suspense> -->
    </TresGroup>
  </TresCanvas>
</template>
