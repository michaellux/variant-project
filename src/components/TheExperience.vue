<script setup lang='ts'>
import type { TresCamera, TresObject3D } from '@tresjs/core'
import { TresCanvas, useTexture, useRenderLoop, useSeek } from '@tresjs/core'
import type { ShallowRef } from 'vue'
import { watch, reactive, shallowRef, shallowReactive, onMounted, onUnmounted } from 'vue'
import type { Camera, Renderer } from 'three'
import {
  Mesh, CubeTextureLoader,
  Raycaster, Vector2, Vector3, RepeatWrapping, NearestMipmapNearestFilter, TextureLoader,
  BasicShadowMap, SRGBColorSpace, REVISION,
  NoToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
  CineonToneMapping,
  ACESFilmicToneMapping,
  Color
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls, Stats, vLog, useGLTF, vLightHelper } from '@tresjs/cientos'
import type Asset from '../sources'
import sources from '../sources'
import { ColorGUIHelper } from '../helpers'
import GUI from 'lil-gui'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { truthy, falsy } from '../typeHelpers'
import ls from 'localstorage-slim'
import AES from 'crypto-js/aes'
import encUTF8 from 'crypto-js/enc-utf8'

ls.config.encrypt = true
ls.config.secret = 'your-secret-key'
ls.config.encrypter = (data, secret) => AES.encrypt(JSON.stringify(data), secret).toString()
ls.config.decrypter = (data, secret) => JSON.parse(AES.decrypt(data, secret).toString(encUTF8))

const gl = reactive({
  clearColor: '#b9b9b4',
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: ACESFilmicToneMapping
})

const THREE_PATH = `https://unpkg.com/three@0.${REVISION}.x`
const canvasRef: ShallowRef<TresInstance | null> = shallowRef(null)
const ambientLightRef: ShallowRef<TresObject3D | null> = shallowRef(null)
const directionalLightRef: ShallowRef<TresObject3D | null> = shallowRef(null)
const directionalLightRef2: ShallowRef<TresObject3D | null> = shallowRef(null)
const transformControlsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const cameraRef: ShallowRef<TresCamera | null> = shallowRef(null)
const groupRef: ShallowRef<TresObject3D | null> = shallowRef(null)
const choosenMeshRef: ShallowRef<TresInstance | null> = shallowRef(null)

let gui = null
let positionFolder = null
let textureFolder = null
let presetFolder = null
let deleteMeshController = null
let materialFolder = null
let lightFolder = null
let renderer: Renderer = null

const notChoosetext = 'Не выбрано'
const { seek } = useSeek()
const transformState = shallowReactive({
  showX: true,
  showY: true,
  showZ: true
})

const controlValues = {
  mesh: notChoosetext,
  addMesh: async function () {
    await handleAddMesh(this.mesh)
  }
}

let cameraControls: OrbitControls = null
let loadingStateNow = true

const handleAddMesh = async (geometryName: string, textureInfo, position, rotation, scale): Promise<void> => {
  if (geometryName !== notChoosetext) {
    const modelFile = sources.find(
      (source) => source.type === 'model' && source.name === geometryName
    )?.path
    if (falsy(modelFile)) {
      console.error('Model file not found')
      return
    }
    const downloadModel = await useGLTF(modelFile, {
      binary: true
    })
    const startTextureInfo = {
      albedo: notChoosetext,
      roughness: notChoosetext,
      metalness: notChoosetext,
      normal: notChoosetext,
      sheen: notChoosetext
    }
    if (textureInfo == null) {
      textureInfo = startTextureInfo
    }
    let meshName = downloadModel.scene.children[0].name
    meshName = `${meshName}|${geometryName}_inScene|${JSON.stringify(textureInfo)}`
    downloadModel.scene.name = `${meshName}|_inScene`
    console.log(downloadModel.scene.children[0].geometry)

    if (truthy(groupRef.value)) {
      groupRef.value.children = [
        ...groupRef.value.children,
        downloadModel.scene
      ]
      console.log(groupRef.value.children)
      saveRootGroupState()
      const addedMesh = seek(groupRef.value, 'uuid', downloadModel.scene.children[0].uuid)
      console.log('attached in add')
      choosenMeshRef.value = addedMesh

      if (position != null) {
        addedMesh?.position.set(position.x as number, position.y as number, position.z as number)
      }
      if (rotation != null) {
        addedMesh?.rotation.set(rotation.x as number, rotation.y as number, rotation.z as number)
      }
      if (scale != null) {
        addedMesh?.scale.set(scale.x as number, scale.y as number, scale.z as number)
      }

      saveAttachedMeshState(addedMesh?.uuid)
      attachControlPanels()
    } else {
      console.error('groupRef is not initialized')
    }
  } else {
    alert('Не выбрана геометрия!')
  }
}

const handleApplyTexture = async (textureSubtypeName: string): Promise<void> => {
  const modelMaterial = choosenMeshRef.value.material
  const newMaterial = new modelMaterial.constructor()
  const finalTexture = {
    map: null,
    roughnessMap: null,
    metalnessMap: null,
    normalMap: null,
    sheenRoughnessMap: null
  }
  if (textureSubtypeName !== notChoosetext) {
    const applyTexture = (texture, subtype): void => {
      const downloadedTexture = texture
      if (falsy(downloadedTexture.isCompressedTexture)) {
        if (downloadedTexture.map != null) {
          finalTexture.map = downloadedTexture.map
        }
        if (downloadedTexture.roughnessMap != null) {
          finalTexture.roughnessMap = downloadedTexture.roughnessMap
        }
        if (downloadedTexture.metalnessMap != null) {
          finalTexture.metalnessMap = downloadedTexture.metalnessMap
        }
        if (downloadedTexture.normalMap != null) {
          finalTexture.normalMap = downloadedTexture.normalMap
        }
        if (subtype === 'sheen') {
          finalTexture.sheenRoughnessMap = downloadedTexture
        }
      } else {
        switch (subtype) {
          case 'albedo':
            finalTexture.map = downloadedTexture
            break
          case 'roughness':
            finalTexture.roughnessMap = downloadedTexture
            break
          case 'metalness':
            finalTexture.metalnessMap = downloadedTexture
            break
          case 'normal':
            finalTexture.normalMap = downloadedTexture
            break
          default:
            break
        }
      }
    }

    const getTexture = (textureSubtypeName): Asset | null => {
      if (textureSubtypeName !== notChoosetext) {
        return sources.find(
          (source) => source.type === 'texture' && source.name === textureSubtypeName
        )
      }
      return null
    }
    const texture = {
      path: getTexture(textureSubtypeName) !== null ? getTexture(textureSubtypeName)?.path : null,
      subtype: getTexture(textureSubtypeName) !== null ? getTexture(textureSubtypeName)?.subtype : null
    }
    if (falsy(texture)) {
      console.error('Texture file not found')
      return
    }
    let downloadTexture = null
    const meshNameArr = choosenMeshRef.value.parent.name.split('|')
    const textureInfo: object = JSON.parse(meshNameArr[2] as string)

    const albedoTexture = {
      path: getTexture(textureInfo.albedo) !== null ? getTexture(textureInfo.albedo)?.path : null,
      subtype: getTexture(textureInfo.albedo) !== null ? getTexture(textureInfo.albedo)?.subtype : null
    }
    const roughnessTexture = {
      path: getTexture(textureInfo.roughness) !== null ? getTexture(textureInfo.roughness)?.path : null,
      subtype: getTexture(textureInfo.roughness) !== null ? getTexture(textureInfo.roughness)?.subtype : null
    }
    const metalnessTexture = {
      path: getTexture(textureInfo.metalness) !== null ? getTexture(textureInfo.metalness)?.path : null,
      subtype: getTexture(textureInfo.metalness) !== null ? getTexture(textureInfo.metalness)?.subtype : null
    }
    const normalTexture = {
      path: getTexture(textureInfo.normal) !== null ? getTexture(textureInfo.normal)?.path : null,
      subtype: getTexture(textureInfo.normal) !== null ? getTexture(textureInfo.normal)?.subtype : null
    }

    const sheenTexture = {
      path: getTexture(textureInfo.sheen) !== null ? getTexture(textureInfo.sheen)?.path : null,
      subtype: getTexture(textureInfo.sheen) !== null ? getTexture(textureInfo.sheen)?.subtype : null
    }

    const downloadTextureOptions = {
      map: falsy(albedoTexture.path?.endsWith('.ktx2')) ? albedoTexture?.path : null,
      roughnessMap: falsy(roughnessTexture.path?.endsWith('.ktx2')) ? roughnessTexture?.path : null,
      metalnessMap: falsy(metalnessTexture.path?.endsWith('.ktx2')) ? metalnessTexture?.path : null,
      normalMap: falsy(normalTexture.path?.endsWith('.ktx2')) ? normalTexture?.path : null
    }
    if (falsy(texture?.path.endsWith('.ktx2'))) {
      const textureSubtype = getTexture(textureSubtypeName)?.subtype
      switch (textureSubtype) {
        case 'albedo':
          downloadTextureOptions.map = texture?.path
          break
        case 'roughness':
          downloadTextureOptions.roughnessMap = texture?.path
          break
        case 'metalness':
          downloadTextureOptions.metalnessMap = texture?.path
          break
        case 'normal':
          downloadTextureOptions.normalMap = texture?.path
          break
        default:
          break
      }
    }

    downloadTexture = await useTexture(downloadTextureOptions)
    if (!Object.values(downloadTextureOptions).every(val => val === null)) {
      applyTexture(downloadTexture)
    }
    if (sheenTexture?.path !== null) {
      const sheenLoader = new TextureLoader()
      const texture = await sheenLoader.loadAsync(sheenTexture?.path as string)
      applyTexture(texture, sheenTexture?.subtype)
    }
    const ktx2Loader = new KTX2Loader()
      .setTranscoderPath(`${THREE_PATH}/examples/jsm/libs/basis/`)
      .detectSupport(canvasRef.value.context.renderer.value)
    const loadKTXTexture = async (texturePath, textureSubtype): Promise<void> => {
      try {
        const texture = await ktx2Loader.loadAsync(texturePath)
        texture.minFilter = NearestMipmapNearestFilter
        applyTexture(texture, textureSubtype)
      } catch (e) {
        console.error(e)
      }
    }
    if (truthy(texture?.path?.endsWith('.ktx2'))) {
      await loadKTXTexture(texture?.path, texture?.subtype)
    }
    if (truthy(albedoTexture?.path?.endsWith('.ktx2'))) {
      await loadKTXTexture(albedoTexture?.path, albedoTexture?.subtype)
    }
    if (truthy(roughnessTexture?.path?.endsWith('.ktx2'))) {
      await loadKTXTexture(roughnessTexture?.path, roughnessTexture?.subtype)
    }
    if (truthy(metalnessTexture?.path?.endsWith('.ktx2'))) {
      await loadKTXTexture(metalnessTexture?.path, metalnessTexture?.subtype)
    }
    if (truthy(normalTexture?.path?.endsWith('.ktx2'))) {
      await loadKTXTexture(normalTexture?.path, normalTexture?.subtype)
    }
    choosenMeshRef.value.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = newMaterial // применяем свежий материал
        if (finalTexture.map !== null) {
          child.material.map = finalTexture.map
          child.material.map.wrapS = RepeatWrapping
          child.material.map.wrapT = RepeatWrapping
          child.material.map.x = 0.5
          child.material.map.y = 0.5
          child.material.map.rotation = Math.PI * 0.5
          child.material.map.needsUpdate = true
        }
        if (finalTexture.roughnessMap !== null) {
          child.material.roughnessMap = finalTexture.roughnessMap
          child.material.roughnessMap.wrapS = RepeatWrapping
          child.material.roughnessMap.wrapT = RepeatWrapping
          child.material.roughnessMap.x = 0.5
          child.material.roughnessMap.y = 0.5
          child.material.roughnessMap.rotation = Math.PI * 0.5
          child.material.roughnessMap.needsUpdate = true
        }
        if (finalTexture.metalnessMap !== null) {
          child.material.metalnessMap = finalTexture.metalnessMap
          child.material.metalnessMap.wrapS = RepeatWrapping
          child.material.metalnessMap.wrapT = RepeatWrapping
          child.material.metalnessMap.x = 0.5
          child.material.metalnessMap.y = 0.5
          child.material.metalnessMap.rotation = Math.PI * 0.5
          child.material.metalnessMap.needsUpdate = true
        }
        if (finalTexture.normalMap !== null) {
          child.material.normalMap = finalTexture.normalMap
          child.material.normalMap.wrapS = RepeatWrapping
          child.material.normalMap.wrapT = RepeatWrapping
          child.material.normalMap.x = 0.5
          child.material.normalMap.y = 0.5
          child.material.normalMap.rotation = Math.PI * 0.5
          child.material.normalMap.needsUpdate = true
        }
        if (finalTexture.sheenRoughnessMap !== null) {
          child.material.sheenRoughnessMap = finalTexture.sheenRoughnessMap
          child.material.sheenRoughnessMap.wrapS = RepeatWrapping
          child.material.sheenRoughnessMap.wrapT = RepeatWrapping
          child.material.sheenRoughnessMap.x = 0.5
          child.material.sheenRoughnessMap.y = 0.5
          child.material.sheenRoughnessMap.rotation = Math.PI * 0.5
          child.material.sheenRoughnessMap.needsUpdate = true
        }
      }
    })
  }
  saveRootGroupState()
}

const handleDeleteMesh = (): void => {
  const removeByKey = (array: [], key, value): [] => {
    const index = array.findIndex(item => item[key] === value)
    if (index !== -1) {
      array.splice(index, 1)
    }
    return array
  }

  if (truthy(choosenMeshRef.value)) {
    const rootMeshGroup = choosenMeshRef.value.parent
    const target = rootMeshGroup.uuid
    removeByKey(groupRef.value.children, 'uuid', target)
    choosenMeshRef.value.traverse((child) => {
      if (child instanceof Mesh) {
        if (truthy(child.geometry)) {
          child.geometry.dispose()
        }
        if (truthy(child.material)) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
    choosenMeshRef.value = null
    rootMeshGroup.value = null

    positionFolder.hide()
    textureFolder.hide()
    deleteMeshController.destroy()
    deleteMeshController = null
  }
  saveRootGroupState()
}

const loadRootGroupState = async (): void => {
  console.log('loadGroupState')
  const rootGroupState = ls.get('rootGroupState', { decrypt: true })
  if (truthy(rootGroupState)) {
    if (truthy(groupRef.value)) {
      await rootGroupState.reduce(async (previousPromise, item) => {
        await previousPromise
        await handleAddMesh(
          item.geometryName as string,
          item.textureInfo as object,
          item.position as object,
          item.rotation as object,
          item.scale as object
        ).then(async () => {
          const texturePromises: Array<Promise<void>> = Object.values(item.textureInfo as object).map(async textureSubtypeName => {
            await handleApplyTexture(textureSubtypeName as string)
          })
          return await Promise.all(texturePromises)
        })
      }, Promise.resolve())
      loadingStateNow = false
      console.log('можно сохранять')
    } else {
      console.error('groupRef is not initialized')
    }
  } else {
    loadingStateNow = false
    console.log('можно сохранять')
  }
}

const saveRootGroupState = (): void => {
  if (!loadingStateNow) {
    console.log('SaveRootGroupState')
    let meshes = []
    groupRef.value.children.forEach(rootGroup => {
      const meshNameArr = rootGroup.name.split('|')
      const geometryName = meshNameArr[1].split('_')[0]
      const textureInfo = JSON.parse(meshNameArr[2])
      const rootMeshInGroup = rootGroup.children[0]
      const meshInfo = {
        position: {
          x: rootMeshInGroup.position.x,
          y: rootMeshInGroup.position.y,
          z: rootMeshInGroup.position.z
        },
        rotation: {
          x: rootMeshInGroup.rotation.x,
          y: rootMeshInGroup.rotation.y,
          z: rootMeshInGroup.rotation.z
        },
        scale: {
          x: rootMeshInGroup.scale.x,
          y: rootMeshInGroup.scale.y,
          z: rootMeshInGroup.scale.z
        },
        geometryName,
        textureInfo
      }
      meshes = [...meshes, meshInfo]
    })
    ls.set('rootGroupState', meshes, { encrypt: true })
  }
}

const saveCameraState = (): void => {
  localStorage.setItem('camera.position.x', cameraRef.value.position.x.toString())
  localStorage.setItem('camera.position.y', cameraRef.value.position.y.toString())
  localStorage.setItem('camera.position.z', cameraRef.value.position.z.toString())
  localStorage.setItem('camera.rotation.x', cameraRef.value.rotation.x.toString())
  localStorage.setItem('camera.rotation.y', cameraRef.value.rotation.y.toString())
  localStorage.setItem('camera.rotation.z', cameraRef.value.rotation.z.toString())
  localStorage.setItem('camera.zoom', cameraRef.value.zoom.toString())

  localStorage.setItem('controls.target.x', cameraControls.target.x.toString())
  localStorage.setItem('controls.target.y', cameraControls.target.y.toString())
  localStorage.setItem('controls.target.z', cameraControls.target.z.toString())
}

const saveAttachedMeshState = (uuid): void => {
  localStorage.setItem('attachedMeshState', uuid as string)
}

const loadAttachedMeshState = (): void => {
  console.log('loadAttached')
  const loadedMeshState = localStorage.getItem('attachedMeshState')
  if (truthy(loadedMeshState)) {
    const targetMesh = seek(groupRef.value, 'uuid', loadedMeshState)
    choosenMeshRef.value = targetMesh
  }
}

const raycaster = new Raycaster()
const mouse = new Vector2()

const attachControlPanels = (): void => {
  if (positionFolder === null) {
    positionFolder = gui.addFolder('Position')
    positionFolder.add(choosenMeshRef.value.position, 'x').min(-10).max(10).step(0.01).listen()
    positionFolder.add(choosenMeshRef.value.position, 'y').min(-10).max(10).step(0.01).listen()
    positionFolder.add(choosenMeshRef.value.position, 'z').min(-10).max(10).step(0.01).listen()
  } else {
    positionFolder.show()
  }
  if (textureFolder === null) {
    textureFolder = gui.addFolder('Textures')
    const textures = sources.filter((source) => source.type === 'texture')
    const textureSubTypeNames = new Set(textures.map((texture) => texture.subtype))
    const controls = {}
    textureSubTypeNames.forEach((subtype) => {
      controls[subtype] = notChoosetext
    })
    textureSubTypeNames.forEach((subtype) => {
      textureFolder?.add(controls, subtype, textures
        .filter((source) => source.subtype === subtype)
        .map((source) => source.name)
      )
        .onChange(event => {
          const meshNameArr = choosenMeshRef.value.parent.name.split('|')
          const textureInfo = JSON.parse(meshNameArr[2] as string)
          console.log(subtype)
          textureInfo[subtype] = event
          choosenMeshRef.value.parent.name = [
            meshNameArr[0],
            meshNameArr[1],
            JSON.stringify(textureInfo),
            meshNameArr[3]].join('|')
          void handleApplyTexture(event as string)
        })
        .listen()
    })
  } else {
    positionFolder.controllers.forEach(controller => {
      controller.object = choosenMeshRef.value.position
    })
    textureFolder.show()
    textureFolder.controllers.forEach(controller => {
      const meshNameArr = choosenMeshRef.value.parent.name.split('|')
      const textureInfo = JSON.parse(meshNameArr[2] as string)
      controller.object = textureInfo
    })
  }
  if (deleteMeshController == null) {
    controlValues.removeMesh = function () {
      handleDeleteMesh()
    }
    deleteMeshController = gui.add(controlValues, 'removeMesh').name('Delete')
  }

  const currentMaterial = choosenMeshRef.value.material
  const materialColor = currentMaterial.color.getHexString()
  const materialSheenColor = currentMaterial.sheenColor.getHexString()
  const materialValues = {
    color: `#${materialColor}`,
    roughness: currentMaterial.roughness,
    metalness: currentMaterial.metalness,
    ior: currentMaterial.ior,
    iridescence: currentMaterial.iridescence,
    iridescenceIOR: currentMaterial.iridescenceIOR,
    reflectivity: currentMaterial.reflectivity,
    sheen: currentMaterial.sheen,
    sheenRoughness: currentMaterial.sheenRoughness,
    sheenColor: `#${materialSheenColor}`,
    clearcoat: currentMaterial.clearcoat,
    clearcoatRoughness: currentMaterial.clearcoatRoughness,
    envMapIntensity: currentMaterial.envMapIntensity
  }

  if (presetFolder == null) {
    const parameters = {
      isLeather: false,
      isMetal: false,
      isVelours: false,
      isWood: false
    }
    presetFolder = gui.addFolder('Presets material param')
    presetFolder.add(parameters, 'isLeather').name('Leather').listen().onChange(function () { setChecked('isLeather') })
    presetFolder.add(parameters, 'isMetal').name('Metal').listen().onChange(function () { setChecked('isMetal') })
    presetFolder.add(parameters, 'isVelours').name('Velours').listen().onChange(function () { setChecked('isVelours') })
    presetFolder.add(parameters, 'isWood').name('Wood').listen().onChange(function () { setChecked('isWood') })

    const setLight = (light, intensity, color, position): void => {
      light.intensity = intensity
      light.color = new Color(color as string)
      light.position.set(position.x, position.y, position.z)
    }

    const setChecked = (prop: string): void => {
      for (const param in parameters) {
        parameters[param] = false
      }
      parameters[prop] = true
      switch (prop) {
        case 'isLeather':
          canvasRef.value.context.renderer.value.toneMappingExposure = 1.447
          canvasRef.value.context.renderer.value.toneMapping = LinearToneMapping
          choosenMeshRef.value.material.color = new Color('#ffffff')
          choosenMeshRef.value.material.roughness = 1
          choosenMeshRef.value.material.metalness = 1
          choosenMeshRef.value.material.reflectivity = 0.5
          choosenMeshRef.value.material.iridescence = 0
          choosenMeshRef.value.material.iridescenceIOR = 0
          choosenMeshRef.value.material.envMapIntensity = 0.3
          setLight(directionalLightRef.value, 10, '#b4bcd5', new Vector3(-1.19, 0.59, 0.33))
          setLight(directionalLightRef2.value, 1.222, '#525b74', new Vector3(6.44, 3, 4.15))
          break
        case 'isMetal':
          canvasRef.value.context.renderer.value.toneMappingExposure = 1.447
          canvasRef.value.context.renderer.value.toneMapping = ACESFilmicToneMapping
          choosenMeshRef.value.material.color = new Color('#ffffff')
          choosenMeshRef.value.material.roughness = 1
          choosenMeshRef.value.material.metalness = 1
          choosenMeshRef.value.material.envMapIntensity = 1
          break
        case 'isVelours':
          canvasRef.value.context.renderer.value.toneMappingExposure = 3
          canvasRef.value.context.renderer.value.toneMapping = ACESFilmicToneMapping
          choosenMeshRef.value.material.color = new Color('#715656')
          choosenMeshRef.value.material.roughness = 0.57
          choosenMeshRef.value.material.sheen = 0.52
          choosenMeshRef.value.material.sheenRoughness = 0.45
          choosenMeshRef.value.material.sheenColor = new Color('#500202')
          choosenMeshRef.value.material.envMapIntensity = 0
          setLight(directionalLightRef.value, 2.367, '#ffffff', new Vector3(-0.94, 1.1, 1.6))
          setLight(directionalLightRef2.value, 1.35, '#ffffff', new Vector3(5.67, 3, -0.94))
          break
        case 'isWood':
          canvasRef.value.context.renderer.value.toneMappingExposure = 1.447
          canvasRef.value.context.renderer.value.toneMapping = ACESFilmicToneMapping
          choosenMeshRef.value.material.color = new Color('#ffffff')
          choosenMeshRef.value.material.roughness = 1
          choosenMeshRef.value.material.metalness = 0
          choosenMeshRef.value.material.ior = 1.45
          choosenMeshRef.value.material.reflectivity = 1
          choosenMeshRef.value.material.iridescence = 0.2
          choosenMeshRef.value.material.iridescenceIOR = 0.08
          choosenMeshRef.value.material.specularIntensity = 0.5
          choosenMeshRef.value.material.specularColor = new Color('#ffffff')
          choosenMeshRef.value.material.envMapIntensity = 0.35
          choosenMeshRef.value.material.needsUpdate = true
          setLight(directionalLightRef.value, 2.367, '#bb966e', new Vector3(-0.94, 1.1, 1.6))
          setLight(directionalLightRef2.value, 1.35, '#5a4430', new Vector3(5.67, 3, -0.94))
          break
        default:
          break
      }
    }
  }

  if (materialFolder == null) {
    materialFolder = gui.addFolder('Material')
    materialFolder.addColor(materialValues, 'color')
      .onChange(function () {
        const colorValue = parseInt(materialValues.color.replace('#', '0x'), 16)
        choosenMeshRef.value.material.color.set(colorValue)
      }).listen()
    materialFolder.add(materialValues, 'roughness', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.roughness = materialValues.roughness
      }).listen()
    materialFolder.add(materialValues, 'metalness', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.metalness = materialValues.metalness
      }).listen()
    materialFolder.add(materialValues, 'reflectivity', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.reflectivity = materialValues.reflectivity
      }).listen()
    materialFolder.add(materialValues, 'iridescence', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.iridescence = materialValues.iridescence
      }).listen()
    materialFolder.add(materialValues, 'iridescenceIOR', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.iridescenceIOR = materialValues.iridescenceIOR
      }).listen()
    materialFolder.add(materialValues, 'sheen', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.sheen = materialValues.sheen
      }).listen()
    materialFolder.add(materialValues, 'sheenRoughness', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.sheenRoughness = materialValues.sheenRoughness
      }).listen()
    materialFolder.addColor(materialValues, 'sheenColor')
      .onChange(function () {
        const colorValue = parseInt(materialValues.sheenColor.replace('#', '0x'), 16)
        choosenMeshRef.value.material.sheenColor.set(colorValue)
      }).listen()
    materialFolder.add(materialValues, 'clearcoat', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.clearcoat = materialValues.clearcoat
      }).listen()
    materialFolder.add(materialValues, 'clearcoatRoughness', 0, 1, 0.01)
      .onChange(function () {
        choosenMeshRef.value.material.clearcoatRoughness = materialValues.clearcoatRoughness
      }).listen()
    materialFolder.add(materialValues, 'envMapIntensity', 0, 50, 0.01)
      .name('envMap intensity')
      .onChange(function () {
        choosenMeshRef.value.material.envMapIntensity = materialValues.envMapIntensity
      }).listen()
  }

  if (lightFolder == null) {
    lightFolder = gui.addFolder('Light')
    lightFolder.add(directionalLightRef.value, 'intensity').min(0).max(10).step(0.001).name('intensity').listen()
    lightFolder.add(directionalLightRef.value.position, 'x').min(-10).max(10).step(0.01).listen()
    lightFolder.add(directionalLightRef.value.position, 'y').min(-10).max(10).step(0.01).listen()
    lightFolder.add(directionalLightRef.value.position, 'z').min(-10).max(10).step(0.01).listen()
    lightFolder.addColor(new ColorGUIHelper(directionalLightRef.value, 'color'), 'value').name('color').listen()

    lightFolder.add(directionalLightRef2.value, 'intensity').min(0).max(10).step(0.001).name('intensity').listen()
    lightFolder.add(directionalLightRef2.value.position, 'x').min(-10).max(10).step(0.01).listen()
    lightFolder.add(directionalLightRef2.value.position, 'y').min(-10).max(10).step(0.01).listen()
    lightFolder.add(directionalLightRef2.value.position, 'z').min(-10).max(10).step(0.01).listen()
    lightFolder.addColor(new ColorGUIHelper(directionalLightRef2.value, 'color'), 'value').name('color').listen()

    lightFolder.add(ambientLightRef.value, 'intensity').min(0).max(10).step(0.001).name('intensity').listen()
    lightFolder.addColor(new ColorGUIHelper(ambientLightRef.value, 'color'), 'value').name('color').listen()
  }

  const cubeTextureLoader = new CubeTextureLoader()
  const environmentMap = cubeTextureLoader.load([
    'textures/environment/0/px.jpg',
    'textures/environment/0/nx.jpg',
    'textures/environment/0/py.jpg',
    'textures/environment/0/ny.jpg',
    'textures/environment/0/pz.jpg',
    'textures/environment/0/nz.jpg'
  ])
  const scene = canvasRef.value.context.scene.value
  // scene.background = environmentMap
  scene.environment = environmentMap
  choosenMeshRef.value.material.envMap = environmentMap
}

const handleMouseDown = (event): void => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, cameraRef.value)

  const intersects = raycaster.intersectObjects(
    canvasRef.value.context.scene.value.children as [],
    true
  )

  if (intersects.length > 0) {
    const findRootGroupOfMesh = (intersectMesh): Mesh => {
      let currentNode = intersectMesh.parent
      while (truthy(currentNode?.isObject3D) && falsy(currentNode?.isGroup)) {
        currentNode = currentNode.parent
      }
      if (truthy(currentNode?.name.endsWith('_inScene'))) {
        return currentNode
      }
      return null
    }

    for (const intersect of intersects) {
      const intersectType = intersect.object.type
      const intersectMesh = intersect.object
      let rootGroupOfMesh = null
      if (intersectType === 'Mesh') {
        rootGroupOfMesh = findRootGroupOfMesh(intersectMesh)
      }
      if (rootGroupOfMesh !== null) {
        const choosenMesh = rootGroupOfMesh.children[0]
        console.log('choosenMesh', choosenMesh)
        choosenMeshRef.value = choosenMesh
        saveAttachedMeshState(choosenMesh.uuid)
        attachControlPanels()
      }
    }
  }
}

onMounted(() => {
  gui = new GUI()
  const geometries = sources
    .filter((source) => source.type === 'model')
    .map((source) => source.name)

  gui.add(controlValues, 'mesh', geometries)
  gui.add(controlValues, 'addMesh').name('Add mesh')

  gui.add(renderer, 'toneMapping', {
    No: NoToneMapping,
    Linear: LinearToneMapping,
    Reinhard: ReinhardToneMapping,
    Cineon: CineonToneMapping,
    ACESFilmic: ACESFilmicToneMapping
  }).name('Tone Mapping')

  gui.add(renderer, 'toneMappingExposure').min(0).max(10).step(0.001).listen().name('Exposure')

  document.addEventListener('mousedown', handleMouseDown, false)
  document.addEventListener('mouseup', saveRootGroupState, false)
})

const { onLoop } = useRenderLoop()
onLoop(() => {
  if (truthy(cameraControls)) {
    cameraControls.update()
    saveCameraState()
  }
})

watch(
  () => groupRef.value,
  (newValue) => {
    if (truthy(newValue)) {
      loadRootGroupState()
      loadAttachedMeshState()
    }
  },
  { immediate: true }
)

watch(
  () => canvasRef.value,
  (newValue) => {
    if (truthy(newValue)) {
      renderer = canvasRef.value.context.renderer.value
      if (truthy(renderer)) {
        const camera: Camera = canvasRef.value.context.camera.value
        const loadCameraState = (): void => {
          if (localStorage.getItem('camera.position.x') !== null) {
            camera.position.x = parseFloat(localStorage.getItem('camera.position.x'))
            camera.position.y = parseFloat(localStorage.getItem('camera.position.y'))
            camera.position.z = parseFloat(localStorage.getItem('camera.position.z'))

            camera.rotation.x = parseFloat(localStorage.getItem('camera.rotation.x'))
            camera.rotation.y = parseFloat(localStorage.getItem('camera.rotation.y'))
            camera.rotation.z = parseFloat(localStorage.getItem('camera.rotation.z'))

            camera.zoom = parseFloat(localStorage.getItem('camera.zoom'))
          }
        }
        loadCameraState()
        cameraControls = new OrbitControls(camera, renderer.domElement)
        if (localStorage.getItem('controls.target.x') !== null) {
          cameraControls.target.x = parseFloat(localStorage.getItem('controls.target.x'))
          cameraControls.target.y = parseFloat(localStorage.getItem('controls.target.y'))
          cameraControls.target.z = parseFloat(localStorage.getItem('controls.target.z'))
        }

        cameraControls.enableDamping = true // for smooth movement
        cameraControls.dampingFactor = 0.05 // adjust as needed
        cameraControls.enableZoom = true
        cameraControls.zoomSpeed = 1.0
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  document.removeEventListener('mousedown', handleMouseDown, false)
  document.removeEventListener('mouseup', saveRootGroupState, false)
})
</script>

<template>
  <TresCanvas ref='canvasRef' v-bind='gl' shadows preset='realistic'>
    <Stats style='left: 1.5rem; top: 1.5rem' />
    <TresPerspectiveCamera
      ref='cameraRef'
    />
    <TransformControls v-log
    ref='transformControlsRef'
    v-if='choosenMeshRef'
    :object='choosenMeshRef'
    v-bind='transformState'
    @mouse-down='() => { cameraControls.enabled = false }'
    @mouse-up='() => { cameraControls.enabled = true }'
    />
    <TresAmbientLight ref='ambientLightRef' :intensity="1" />
   <TresDirectionalLight
      ref='directionalLightRef'
      v-light-helper
      color='#ffffff'
      :position='[0, 3, 1]'
      :intensity='1'
      cast-shadow
    />
    <TresDirectionalLight
      ref='directionalLightRef2'
      v-light-helper
      color='#ffffff'
      :position='[0, 3, 1]'
      :intensity='1'
      cast-shadow
    />
    <TresGridHelper :args='[500, 50]' />
    <TresAxesHelper :args='[100]' />
    <Suspense>
    <TresGroup ref='groupRef' v-log>
    </TresGroup>
    </Suspense>
  </TresCanvas>
</template>
