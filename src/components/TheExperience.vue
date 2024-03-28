<script setup lang="ts">
import { TresCanvas, useTexture, useRenderLoop, useSeek } from "@tresjs/core";
import { watch, watchEffect, reactive, shallowReactive, shallowRef, onMounted, onUnmounted } from "vue";
import { Mesh, BasicShadowMap, SRGBColorSpace, NoToneMapping, REVISION } from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls, Stats, vLog, useGLTF } from "@tresjs/cientos";
import { Raycaster, Vector2, RepeatWrapping, NearestMipmapNearestFilter, TextureLoader, ObjectLoader } from "three";
import sources from "../sources";
import GUI, { Controller } from 'lil-gui';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

import ls from 'localstorage-slim';
import AES from 'crypto-js/aes';
import encUTF8 from 'crypto-js/enc-utf8';

ls.config.encrypt = true;
ls.config.secret = 'your-secret-key'; // Замените на свой секретный ключ

ls.config.encrypter = (data, secret) => AES.encrypt(JSON.stringify(data), secret).toString();
ls.config.decrypter = (data, secret) => JSON.parse(AES.decrypt(data, secret).toString(encUTF8));

const gl = reactive({
  clearColor: "#b9b9b4",
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
});

const THREE_PATH = `https://unpkg.com/three@0.${REVISION}.x`;
const canvasRef: ShallowRef<TresInstance | null> = shallowRef(null);
const orbitControlsRef: ShallowRef<TresInstance | null> = shallowRef(null);
const transformControlsRef: ShallowRef<TresInstance | null> = shallowRef(null);
const cameraRef: ShallowRef<TresInstance | null> = shallowRef(null);
const groupRef: ShallowRef<TresInstance | null> = shallowRef(null);
const choosenMeshRef: ShallowRef<TresInstance | null> = shallowRef(null);
let context = null;
let gui = null;
let positionFolder = null;
let textureFolder = null;
let deleteMeshController = null;
const notChoosetext = "Не выбрано";
const { seek, seekByName } = useSeek()
const transformState = shallowReactive({
  showX: true,
  showY: true,
  showZ: true,
});

const controlValues = {
  mesh: notChoosetext,
  addMesh: function() {
    handleAddMesh(this.mesh)
  }
}

let cameraControls = null;

let loadingStateNow = true;

const handleAddMesh = async (geometryName: string, textureInfo, position, rotation, scale) => {
  if (geometryName !== notChoosetext) {
    const modelFile = sources.find(
      (source) => source.type === "model" && source.name === geometryName
    )?.path;
    if (!modelFile) {
      console.error("Model file not found");
      return;
    }
    const downloadModel = await useGLTF(modelFile, {
      binary: true,
    });
    const startTextureInfo = {
      albedo: notChoosetext,
      roughness: notChoosetext,
      metalness: notChoosetext,
      normal: notChoosetext,
      sheen: notChoosetext
    };
    if (textureInfo == null) {
      textureInfo = startTextureInfo;
    }
    let meshName = downloadModel.scene.children[0].name;
    meshName = `${meshName}|${geometryName}_inScene|${JSON.stringify(textureInfo)}`;
    downloadModel.scene.name = `${meshName}|_inScene`;
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
      console.log(groupRef.value.children);
      saveRootGroupState();
      const addedMesh = seek(groupRef.value, "uuid", downloadModel.scene.children[0].uuid);
      console.log("attached in add");
      choosenMeshRef.value = addedMesh;

    if (position != null) {
      addedMesh?.position.set(position.x, position.y, position.z);
    }
    if (rotation != null) {
       addedMesh?.rotation.set(rotation.x, rotation.y, rotation.z);
    }
    if (scale != null) {
      addedMesh?.scale.set(scale.x, scale.y, scale.z);
    }

      saveAttachedMeshState(addedMesh?.uuid);
      attachControlPanels();
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
    sheenRoughnessMap: null,
  };
  if (textureSubtypeName !== notChoosetext) {
    const applyTexture = (texture, subtype) => {
      const downloadedTexture = texture;
      if (!downloadedTexture.isCompressedTexture) {
          if (downloadedTexture.map != null) {
            finalTexture.map = downloadedTexture.map;
          }
          if (downloadedTexture.roughnessMap != null) {
            finalTexture.roughnessMap = downloadedTexture.roughnessMap;
          }
          if (downloadedTexture.metalnessMap != null) {
            finalTexture.metalnessMap = downloadedTexture.metalnessMap;
          }
          if (downloadedTexture.normalMap != null) {
            finalTexture.normalMap = downloadedTexture.normalMap;
          }
          if (subtype === "sheen") {
            finalTexture.sheenRoughnessMap = downloadedTexture;
          }
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
    const meshNameArr = choosenMeshRef.value.parent.name.split("|");
    const textureInfo = JSON.parse(meshNameArr[2]);

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

    let sheenTexture = {
      path: getTexture(textureInfo.sheen) !== null ? getTexture(textureInfo.sheen)?.path : null,
      subtype: getTexture(textureInfo.sheen) !== null ? getTexture(textureInfo.sheen)?.subtype : null
    }

    let downloadTextureOptions = {
      map: !albedoTexture.path?.endsWith(".ktx2") ? albedoTexture?.path : null,
      roughnessMap: !roughnessTexture.path?.endsWith(".ktx2") ? roughnessTexture?.path : null,
      metalnessMap: !metalnessTexture.path?.endsWith(".ktx2") ? metalnessTexture?.path : null,
      normalMap: !normalTexture.path?.endsWith(".ktx2") ? normalTexture?.path : null,
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
        default:
          break;
      }
    }

    downloadTexture = await useTexture(downloadTextureOptions);
    if (!Object.values(downloadTextureOptions).every(val => val === null)) {
      applyTexture(downloadTexture);
    }
    if (sheenTexture?.path !== null) {
      const sheenLoader = new TextureLoader();
      const texture = await sheenLoader.loadAsync(sheenTexture?.path);
      applyTexture(texture, sheenTexture?.subtype);
    }
    const ktx2Loader = new KTX2Loader()
    .setTranscoderPath(`${THREE_PATH}/examples/jsm/libs/basis/`)
    .detectSupport(canvasRef.value.context.renderer.value); 
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
        if (finalTexture.sheenRoughnessMap !== null) {
          child.material.sheenRoughnessMap = finalTexture.sheenRoughnessMap;
          child.material.sheenRoughnessMap.wrapS = RepeatWrapping;
          child.material.sheenRoughnessMap.wrapT = RepeatWrapping;
          child.material.sheenRoughnessMap.x = 0.5
          child.material.sheenRoughnessMap.y = 0.5
          child.material.sheenRoughnessMap.rotation = Math.PI * 0.5
          child.material.sheenRoughnessMap.needsUpdate = true;
        }

        /*child.material.attenuationColor = modelMaterial.attenuationColor;
        child.material.clearcoatNormalScale = modelMaterial.clearcoatNormalScale;
      
        child.material.defines = modelMaterial.defines;
        child.material.emissive = modelMaterial.emissive;
        child.material.ior = modelMaterial.ior;
        child.material.iridescenceThicknessRange = modelMaterial.iridescenceThicknessRange;

        child.material.normalScale = modelMaterial.normalScale;
        child.material.roughness = modelMaterial.roughness;
        child.material.sheenColor = modelMaterial.sheenColor;
        child.material.sheenRoughness = modelMaterial.sheenRoughness;
        child.material.side = modelMaterial.side;
        child.material.specularColor = modelMaterial.specularColor;
        child.material.specularIntensity = modelMaterial.specularIntensity

        child.material.metalness = modelMaterial.metalness; // если добавить будет "сильно" тёмная текстура
        child.material.color = modelMaterial.color; // если добавить будет "несильно" тёмная текстура*/
      }
    });
  }
  saveRootGroupState();
};

const handleDeleteMesh = () => {
  const removeByKey = (array, key, value) => {
    const index = array.findIndex(item => item[key] === value);
    if (index !== -1) {
        array.splice(index, 1);
    }
    return array;
  }

  if (choosenMeshRef.value) {
    const rootMeshGroup = choosenMeshRef.value.parent;
    const target = rootMeshGroup.uuid;
    console.log(groupRef.value.children);
    removeByKey(groupRef.value.children, 'uuid', target);
    console.log(groupRef.value.children);
    choosenMeshRef.value.traverse((child) => {
      if (child instanceof Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    choosenMeshRef.value = null;
    rootMeshGroup.value = null;

    positionFolder.hide();
    textureFolder.hide();
    deleteMeshController.destroy();
    deleteMeshController = null;
  }
  saveRootGroupState();
};

const loadRootGroupState = async () => {
 console.log("loadGroupState");
 const rootGroupState = ls.get('rootGroupState', { decrypt: true });
 if (rootGroupState) {
    if (groupRef.value) {
     console.log(rootGroupState);
      // Используем reduce для создания цепочки промисов
      await rootGroupState.reduce(async (previousPromise, item) => {
        // Ожидаем завершения предыдущей операции
        await previousPromise;
        // Выполняем обработку текущего элемента
        return handleAddMesh(item.geometryName, item.textureInfo, item.position, item.rotation, item.scale).then(() => {
          // Создаем массив промисов для каждой текстуры
          const texturePromises = Object.values(item.textureInfo).map(textureSubtypeName => {
            return handleApplyTexture(textureSubtypeName);
          });
          // Ожидаем завершения всех промисов текстур
          return Promise.all(texturePromises);
        });
      }, Promise.resolve());
      loadingStateNow = false;
      console.log("можно сохранять");
    } else {
      console.error("groupRef is not initialized");
    }
 } else {
 loadingStateNow = false;
 console.log("можно сохранять");
 }
};

const saveRootGroupState = () => {
  if (!loadingStateNow) {
      console.log("SaveRootGroupState");
      let meshes = [];
      groupRef.value.children.forEach(rootGroup => {
        const meshNameArr = rootGroup.name.split("|");
        const geometryName = meshNameArr[1].split("_")[0];
        const textureInfo = JSON.parse(meshNameArr[2]);
        const rootMeshInGroup = rootGroup.children[0];
        const meshInfo = {
          //rootGroup: rootGroupClone,
          position: {
            x: rootMeshInGroup.position.x,
            y: rootMeshInGroup.position.y,
            z: rootMeshInGroup.position.z,
          },
          rotation: {
            x: rootMeshInGroup.rotation.x,
            y: rootMeshInGroup.rotation.y,
            z: rootMeshInGroup.rotation.z,
          },
          scale: {
            x: rootMeshInGroup.scale.x,
            y: rootMeshInGroup.scale.y,
            z: rootMeshInGroup.scale.z,
          },
          geometryName,
          textureInfo,
        }
        meshes = [...meshes, meshInfo];
      });
    ls.set('rootGroupState', meshes, { encrypt: true });
  }
};

const saveCameraState = () => {
  localStorage.setItem("camera.position.x", cameraRef.value.position.x.toString())
  localStorage.setItem("camera.position.y", cameraRef.value.position.y.toString())
  localStorage.setItem("camera.position.z", cameraRef.value.position.z.toString())
  localStorage.setItem("camera.rotation.x", cameraRef.value.rotation.x.toString())
  localStorage.setItem("camera.rotation.y", cameraRef.value.rotation.y.toString())
  localStorage.setItem("camera.rotation.z", cameraRef.value.rotation.z.toString())
  localStorage.setItem("camera.zoom", cameraRef.value.zoom.toString())

  localStorage.setItem("controls.target.x", cameraControls.target.x.toString())
  localStorage.setItem("controls.target.y", cameraControls.target.y.toString())
  localStorage.setItem("controls.target.z", cameraControls.target.z.toString())
};

const saveAttachedMeshState = (uuid) => {
  localStorage.setItem('attachedMeshState', uuid);
}

const loadAttachedMeshState = () => {
  console.log("loadAttached");
  const loadedMeshState = localStorage.getItem('attachedMeshState');
  if (loadedMeshState) {
    const targetMesh = seek(groupRef.value, "uuid", loadedMeshState);
    choosenMeshRef.value = targetMesh;
  }
}

const raycaster = new Raycaster();
const mouse = new Vector2();

const attachControlPanels = () => {
  if (positionFolder === null) {
      positionFolder = gui.addFolder('Position');
      positionFolder.add(choosenMeshRef.value.position, 'x').min(-10).max(10).step(0.01).listen();
      positionFolder.add(choosenMeshRef.value.position, 'y').min(-10).max(10).step(0.01).listen();
      positionFolder.add(choosenMeshRef.value.position, 'z').min(-10).max(10).step(0.01).listen();
  }
  else {
    positionFolder.show();
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
        const meshNameArr = choosenMeshRef.value.parent.name.split("|");
        const textureInfo = JSON.parse(meshNameArr[2]);
        console.log(subtype);
        textureInfo[subtype] = event;
        choosenMeshRef.value.parent.name = [
          meshNameArr[0],
          meshNameArr[1],
          JSON.stringify(textureInfo),
          meshNameArr[3]].join("|");
        handleApplyTexture(event)
      })
      .listen()
    })
  }
  else {
      positionFolder.controllers.forEach(controller => {
        controller.object = choosenMeshRef.value.position;
      });
      textureFolder.show();
      textureFolder.controllers.forEach(controller => {
        const meshNameArr = choosenMeshRef.value.parent.name.split("|");
        const textureInfo = JSON.parse(meshNameArr[2]);
        controller.object = textureInfo;
      })
  }
  if (deleteMeshController == null) {
    controlValues.removeMesh = function() {
      handleDeleteMesh();
    }
    deleteMeshController = gui.add(controlValues, "removeMesh").name("Delete");
  }
}

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
        saveAttachedMeshState(choosenMesh.uuid);
        attachControlPanels();
      }
    }
  }
};

onMounted(() => {
  gui = new GUI();
  const geometries = sources
      .filter((source) => source.type === "model")
      .map((source) => source.name);

  gui.add(controlValues, "mesh", geometries);
  gui.add(controlValues, "addMesh").name("Add mesh");
  document.addEventListener("mousedown", handleMouseDown, false);
  document.addEventListener("mouseup", saveRootGroupState, false);
});

const { onLoop } = useRenderLoop()
onLoop(({ delta, elapsed, clock }) => {
  if (cameraControls) {
    cameraControls.update();
    saveCameraState();
  }
})

watch(
 () => groupRef.value,
 (newValue, oldValue) => {
    if (newValue) {
      loadRootGroupState();
      loadAttachedMeshState();
    }
 },
 { immediate: true }
);

watch(
 () => canvasRef.value,
 (newValue, oldValue) => {
    if (newValue) {
      if (canvasRef.value.context.renderer.value) {
          const camera = canvasRef.value.context.camera.value;
          const loadCameraState = () => {
 console.log("loadCameraState");
 if (localStorage.getItem("camera.position.x") !== null) {
    camera.position.x = parseFloat(localStorage.getItem("camera.position.x"))
    camera.position.y = parseFloat(localStorage.getItem("camera.position.y"))
    camera.position.z = parseFloat(localStorage.getItem("camera.position.z"))

    camera.rotation.x = parseFloat(localStorage.getItem("camera.rotation.x"))
    camera.rotation.y = parseFloat(localStorage.getItem("camera.rotation.y"))
    camera.rotation.z = parseFloat(localStorage.getItem("camera.rotation.z"))

    camera.zoom = parseFloat(localStorage.getItem("camera.zoom"))
 }
};

          loadCameraState();

          cameraControls = new OrbitControls(camera, canvasRef.value.context.renderer.value.domElement);

          if (localStorage.getItem("controls.target.x") !== null) {
            cameraControls.target.x = parseFloat(localStorage.getItem("controls.target.x"))
            cameraControls.target.y = parseFloat(localStorage.getItem("controls.target.y"))
            cameraControls.target.z = parseFloat(localStorage.getItem("controls.target.z"))
          }
          // Optionally, configure CameraControls as needed
          cameraControls.enableDamping = true; // for smooth movement
          cameraControls.dampingFactor = 0.05; // adjust as needed
          cameraControls.enableZoom = true;
          cameraControls.zoomSpeed = 1.0;
      }
      
    }
 },
 { immediate: true }
);

onUnmounted(() => {
  document.removeEventListener("mousedown", handleMouseDown, false);
  document.removeEventListener("mouseup", saveRootGroupState, false);
});
</script>

<template>
  <TresCanvas ref="canvasRef" v-bind="gl" preset="realistic">
    <Stats style="left: 1.5rem; top: 1.5rem" />
    <TresPerspectiveCamera
      ref="cameraRef"
    />
    <TransformControls v-log
    ref="transformControlsRef"
    v-if="choosenMeshRef" 
    :object="choosenMeshRef" 
    v-bind="transformState" 
    @mouse-down="() => { cameraControls.enabled = false; }"
    @mouse-up="() => { cameraControls.enabled = true; }"
    />
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
    <Suspense>
    <TresGroup ref="groupRef" v-log>
    </TresGroup>
    </Suspense>
  </TresCanvas>
</template>
