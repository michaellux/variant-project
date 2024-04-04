<script setup lang='ts'>
import type { TresObject3D } from '@tresjs/core'
import { TresCanvas, useTexture, useRenderLoop, useSeek } from '@tresjs/core'
import type { ShallowRef } from 'vue'
import { watch, reactive, shallowRef, shallowReactive, onMounted, onUnmounted } from 'vue'
import {
  Mesh, CubeTextureLoader, Group, Texture, PerspectiveCamera,
  Raycaster, Vector2, Vector3, RepeatWrapping, NearestMipmapNearestFilter, TextureLoader,
  BasicShadowMap, SRGBColorSpace, REVISION,
  NoToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
  CineonToneMapping,
  ACESFilmicToneMapping,
  Color,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  CompressedTexture
} from 'three'
import type { Camera, Object3D, Material, WebGLRenderer, Light, DirectionalLight, AmbientLight, Euler } from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls, Stats, vLog, useGLTF, vLightHelper } from '@tresjs/cientos'
import type { Asset, TextureMapInfo, TextureInfo, MeshInfo, MaterialParams } from '../@types/types'
import { truthy, falsy } from '../@types/helpers'
import sources from '../sources'
import { ColorGUIHelper } from '../helpers'
import GUI from 'lil-gui'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import ls from 'localstorage-slim'
import AES from 'crypto-js/aes'
import encUTF8 from 'crypto-js/enc-utf8'

ls.config.encrypt = true
ls.config.secret = 'your-secret-key'
ls.config.encrypter = (data: unknown, secret: unknown) => {
  if (typeof data === 'string' && typeof secret === 'string') {
    return AES.encrypt(JSON.stringify(data), secret).toString()
  } else {
    throw new Error('Both data and secret must be strings')
  }
}
ls.config.decrypter = (data: unknown, secret: unknown) => {
  if (typeof data === 'string' && typeof secret === 'string') {
    return JSON.parse(AES.decrypt(data, secret).toString(encUTF8))
  } else {
    throw new Error('Both data and secret must be strings')
  }
}

const gl = reactive({
  clearColor: '#b9b9b4',
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: ACESFilmicToneMapping
})

const THREE_PATH = `https://unpkg.com/three@0.${REVISION}.x`
const canvasRef: ShallowRef<typeof TresCanvas | null> = shallowRef(null)
const ambientLightRef: ShallowRef<AmbientLight | null> = shallowRef(null)
const directionalLightRef: ShallowRef<DirectionalLight | null> = shallowRef(null)
const directionalLightRef2: ShallowRef<DirectionalLight | null> = shallowRef(null)
const transformControlsRef: ShallowRef<typeof TransformControls | null> = shallowRef(null)
const cameraRef: ShallowRef<Camera | null> = shallowRef(null)
const groupRef: ShallowRef<Object3D<Event> | null> = shallowRef(null)
const choosenMeshRef: ShallowRef<TresObject3D | null> = shallowRef(null)

let gui: GUI | null = null
let positionFolder: GUI | null = null
let textureFolder: GUI | null = null
let presetFolder: GUI | null = null
let deleteMeshController: GUI | null = null
let lightFolder: GUI | null = null
let renderer: WebGLRenderer | null = null

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
  },
  removeMesh: () => {}
}

let cameraControls: OrbitControls | null = null
let loadingStateNow = true

const handleAddMesh = async (geometryName: string, textureInfo?: object, position?: Vector3, rotation?: Euler, scale?: Vector3): Promise<void> => {
  if (geometryName !== notChoosetext) {
    const modelFile = sources.find(
      (source) => source.type === 'model' && source.name === geometryName
    )?.path
    if (falsy(modelFile)) {
      console.error('Model file not found')
      return
    }
    const downloadModel = await useGLTF(modelFile)
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

    if (truthy(groupRef.value)) {
      groupRef.value.children = [
        ...groupRef.value.children,
        downloadModel.scene
      ]
      console.log(groupRef.value.children)
      saveRootGroupState()
      const addedMesh = seek(groupRef.value, 'uuid', downloadModel.scene.children[0].uuid) as TresObject3D
      console.log('attached in add')
      choosenMeshRef.value = addedMesh

      if (position != null) {
        addedMesh?.position.set(position.x, position.y, position.z)
      }
      if (rotation != null) {
        addedMesh?.rotation.set(rotation.x, rotation.y, rotation.z)
      }
      if (scale != null) {
        addedMesh?.scale.set(scale.x, scale.y, scale.z)
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

const handleApplyTexture = async (textureSubtypeName: string, materialParams?: object): Promise<void> => {
  const modelMaterial = choosenMeshRef.value?.material
  let newMaterial: Material | null = null
  if (truthy(modelMaterial)) {
    newMaterial = new MeshPhysicalMaterial()
  }
  const finalTextureMapsInfo: TextureMapInfo = {
    map: null,
    roughnessMap: null,
    metalnessMap: null,
    normalMap: null,
    sheenRoughnessMap: null
  }
  if (textureSubtypeName !== notChoosetext) {
    const applyTexture = (texture: TextureMapInfo | CompressedTexture | Texture, subtype?: string): void => {
      const downloadedTexture = texture
      if (falsy(downloadedTexture instanceof CompressedTexture)) {
        if ('map' in downloadedTexture && downloadedTexture.map != null) {
          finalTextureMapsInfo.map = downloadedTexture.map
        }
        if ('roughnessMap' in downloadedTexture && downloadedTexture.roughnessMap != null) {
          finalTextureMapsInfo.roughnessMap = downloadedTexture.roughnessMap
        }
        if ('metalnessMap' in downloadedTexture && downloadedTexture.metalnessMap != null) {
          finalTextureMapsInfo.metalnessMap = downloadedTexture.metalnessMap
        }
        if ('normalMap' in downloadedTexture && downloadedTexture.normalMap != null) {
          finalTextureMapsInfo.normalMap = downloadedTexture.normalMap
        }
        if (downloadedTexture instanceof Texture && subtype === 'sheen') {
          finalTextureMapsInfo.sheenRoughnessMap = downloadedTexture
        }
      } else if (downloadedTexture instanceof CompressedTexture) {
        switch (subtype) {
          case 'albedo':
            finalTextureMapsInfo.map = downloadedTexture
            break
          case 'roughness':
            finalTextureMapsInfo.roughnessMap = downloadedTexture
            break
          case 'metalness':
            finalTextureMapsInfo.metalnessMap = downloadedTexture
            break
          case 'normal':
            finalTextureMapsInfo.normalMap = downloadedTexture
            break
          default:
            break
        }
      }
    }

    const getTexture = (textureSubtypeName: string): Asset | undefined | null => {
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
    const meshNameArr = choosenMeshRef.value?.parent?.name.split('|')
    const textureInfo: TextureInfo | null = truthy(meshNameArr) ? JSON.parse(meshNameArr[2]) : null
    let albedoTexture = null
    let roughnessTexture = null
    let metalnessTexture = null
    let normalTexture = null
    let sheenTexture = null
    if (truthy(textureInfo)) {
      albedoTexture = {
        path: getTexture(textureInfo.albedo) !== null ? getTexture(textureInfo?.albedo)?.path : null,
        subtype: getTexture(textureInfo.albedo) !== null ? getTexture(textureInfo?.albedo)?.subtype : null
      }
      roughnessTexture = {
        path: getTexture(textureInfo.roughness) !== null ? getTexture(textureInfo.roughness)?.path : null,
        subtype: getTexture(textureInfo.roughness) !== null ? getTexture(textureInfo.roughness)?.subtype : null
      }
      metalnessTexture = {
        path: getTexture(textureInfo.metalness) !== null ? getTexture(textureInfo.metalness)?.path : null,
        subtype: getTexture(textureInfo.metalness) !== null ? getTexture(textureInfo.metalness)?.subtype : null
      }
      normalTexture = {
        path: getTexture(textureInfo.normal) !== null ? getTexture(textureInfo.normal)?.path : null,
        subtype: getTexture(textureInfo.normal) !== null ? getTexture(textureInfo.normal)?.subtype : null
      }
      sheenTexture = {
        path: getTexture(textureInfo.sheen) !== null ? getTexture(textureInfo.sheen)?.path : null,
        subtype: getTexture(textureInfo.sheen) !== null ? getTexture(textureInfo.sheen)?.subtype : null
      }
    }

    const downloadTextureOptions = {
      map: falsy(albedoTexture?.path?.endsWith('.ktx2')) ? albedoTexture?.path : null,
      roughnessMap: falsy(roughnessTexture?.path?.endsWith('.ktx2')) ? roughnessTexture?.path : null,
      metalnessMap: falsy(metalnessTexture?.path?.endsWith('.ktx2')) ? metalnessTexture?.path : null,
      normalMap: falsy(normalTexture?.path?.endsWith('.ktx2')) ? normalTexture?.path : null
    }
    if (falsy(texture?.path?.endsWith('.ktx2'))) {
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
    if (truthy(sheenTexture?.path) && truthy(sheenTexture?.subtype)) {
      const sheenLoader = new TextureLoader()
      const texture = await sheenLoader.loadAsync(sheenTexture?.path)
      applyTexture(texture, sheenTexture?.subtype)
    }

    if (truthy(renderer)) {
      const ktx2Loader = new KTX2Loader()
        .setTranscoderPath(`${THREE_PATH}/examples/jsm/libs/basis/`)
        .detectSupport(renderer)
      const loadKTXTexture = async (texturePath: string, textureSubtype: string): Promise<void> => {
        try {
          const texture: CompressedTexture = await ktx2Loader.loadAsync(texturePath)
          texture.minFilter = NearestMipmapNearestFilter
          applyTexture(texture, textureSubtype)
        } catch (e) {
          console.error(e)
        }
      }
      if (truthy(texture?.subtype) && truthy(texture?.path?.endsWith('.ktx2'))) {
        await loadKTXTexture(texture?.path, texture?.subtype)
      }
      if (truthy(albedoTexture?.subtype) && truthy(albedoTexture?.path?.endsWith('.ktx2'))) {
        await loadKTXTexture(albedoTexture?.path, albedoTexture?.subtype)
      }
      if (truthy(roughnessTexture?.subtype) && truthy(roughnessTexture?.path?.endsWith('.ktx2'))) {
        await loadKTXTexture(roughnessTexture?.path, roughnessTexture?.subtype)
      }
      if (truthy(metalnessTexture?.subtype) && truthy(metalnessTexture?.path?.endsWith('.ktx2'))) {
        await loadKTXTexture(metalnessTexture?.path, metalnessTexture?.subtype)
      }
      if (truthy(normalTexture?.subtype) && truthy(normalTexture?.path?.endsWith('.ktx2'))) {
        await loadKTXTexture(normalTexture?.path, normalTexture?.subtype)
      }
    }

    choosenMeshRef.value?.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = newMaterial

        if (finalTextureMapsInfo.map !== null) {
          child.material.map = finalTextureMapsInfo.map
          child.material.map.wrapS = RepeatWrapping
          child.material.map.wrapT = RepeatWrapping
          child.material.map.x = 0.5
          child.material.map.y = 0.5
          child.material.map.rotation = Math.PI * 0.5
          child.material.map.needsUpdate = true
        }
        if (finalTextureMapsInfo.roughnessMap !== null) {
          child.material.roughnessMap = finalTextureMapsInfo.roughnessMap
          child.material.roughnessMap.wrapS = RepeatWrapping
          child.material.roughnessMap.wrapT = RepeatWrapping
          child.material.roughnessMap.x = 0.5
          child.material.roughnessMap.y = 0.5
          child.material.roughnessMap.rotation = Math.PI * 0.5
          child.material.roughnessMap.needsUpdate = true
        }
        if (finalTextureMapsInfo.metalnessMap !== null) {
          child.material.metalnessMap = finalTextureMapsInfo.metalnessMap
          child.material.metalnessMap.wrapS = RepeatWrapping
          child.material.metalnessMap.wrapT = RepeatWrapping
          child.material.metalnessMap.x = 0.5
          child.material.metalnessMap.y = 0.5
          child.material.metalnessMap.rotation = Math.PI * 0.5
          child.material.metalnessMap.needsUpdate = true
        }
        if (finalTextureMapsInfo.normalMap !== null) {
          child.material.normalMap = finalTextureMapsInfo.normalMap
          child.material.normalMap.wrapS = RepeatWrapping
          child.material.normalMap.wrapT = RepeatWrapping
          child.material.normalMap.x = 0.5
          child.material.normalMap.y = 0.5
          child.material.normalMap.rotation = Math.PI * 0.5
          child.material.normalMap.needsUpdate = true
        }
        if (finalTextureMapsInfo.sheenRoughnessMap !== null) {
          child.material.sheenRoughnessMap = finalTextureMapsInfo.sheenRoughnessMap
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
  const removeByKey = (array: [], key: string, value: unknown): [] => {
    const index = array.findIndex(item => item[key] === value)
    if (index !== -1) {
      array.splice(index, 1)
    }
    return array
  }

  if (truthy(choosenMeshRef.value)) {
    let rootMeshGroup = choosenMeshRef.value.parent
    const target = rootMeshGroup?.uuid
    if (truthy(groupRef.value?.children)) {
      removeByKey(groupRef.value?.children as [], 'uuid', target)
    }
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
    rootMeshGroup = null

    positionFolder?.hide()
    textureFolder?.hide()
    deleteMeshController?.destroy()
    deleteMeshController = null
  }
  saveRootGroupState()
}

const loadRootGroupState = async (): Promise<void> => {
  console.log('loadGroupState')
  const rootGroupState: [] | null = ls.get('rootGroupState', { decrypt: true })
  if (truthy(rootGroupState)) {
    if (truthy(groupRef.value)) {
      await rootGroupState.reduce(async (previousPromise: Promise<void>, item: MeshInfo) => {
        await previousPromise
        await handleAddMesh(
          item.geometryName,
          item.textureInfo,
          item.position,
          item.rotation,
          item.scale
        ).then(async () => {
          const texturePromises: Array<Promise<void>> = Object.values(item.textureInfo).map(async textureSubtypeName => {
            await handleApplyTexture(textureSubtypeName as string, item.materialParams as object)
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
    let meshes: MeshInfo[] = []
    groupRef.value?.children.forEach(rootGroup => {
      const meshNameArr = rootGroup.name.split('|')
      const geometryName = meshNameArr[1].split('_')[0]
      const textureInfo: TextureInfo = JSON.parse(meshNameArr[2])
      const rootMeshInGroup: TresObject3D = rootGroup.children[0] as TresObject3D
      const materialParams: MaterialParams = {
        color: rootMeshInGroup.material instanceof MeshBasicMaterial ? rootMeshInGroup.material.color : null,
        roughness: rootMeshInGroup.material instanceof MeshStandardMaterial ? rootMeshInGroup.material.roughness : null,
        metalness: rootMeshInGroup.material instanceof MeshStandardMaterial ? rootMeshInGroup.material.metalness : null,
        reflectivity: rootMeshInGroup.material instanceof MeshPhongMaterial ? rootMeshInGroup.material.reflectivity : null,
        ior: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.ior : null,
        iridescence: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.iridescence : null,
        iridescenceIOR: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.iridescenceIOR : null,
        envMapIntensity: rootMeshInGroup.material instanceof MeshStandardMaterial ? rootMeshInGroup.material.envMapIntensity : null,
        sheen: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.sheen : null,
        sheenRoughness: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.sheenRoughness : null,
        sheenColor: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.sheenColor : null,
        specularIntensity: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.specularIntensity : null,
        specularColor: rootMeshInGroup.material instanceof MeshPhysicalMaterial ? rootMeshInGroup.material.specularColor : null
      }
      const meshInfo: MeshInfo = {
        position: rootMeshInGroup.position,
        rotation: rootMeshInGroup.rotation,
        scale: rootMeshInGroup.scale,
        geometryName,
        textureInfo,
        materialParams
      }
      meshes = [...meshes, meshInfo]
    })
    ls.set('rootGroupState', meshes, { encrypt: true })
  }
}

const saveCameraState = (): void => {
  localStorage.setItem('camera.position.x', (cameraRef.value?.position.x ?? '0').toString())
  localStorage.setItem('camera.position.y', (cameraRef.value?.position.y ?? '0').toString())
  localStorage.setItem('camera.position.z', (cameraRef.value?.position.z ?? '0').toString())
  localStorage.setItem('camera.rotation.x', (cameraRef.value?.rotation.x ?? '0').toString())
  localStorage.setItem('camera.rotation.y', (cameraRef.value?.rotation.y ?? '0').toString())
  localStorage.setItem('camera.rotation.z', (cameraRef.value?.rotation.z ?? '0').toString())
  localStorage.setItem('camera.zoom', ((cameraRef.value as PerspectiveCamera)?.zoom ?? '0').toString())

  localStorage.setItem('controls.target.x', (cameraControls?.target.x ?? '0').toString())
  localStorage.setItem('controls.target.y', (cameraControls?.target.y ?? '0').toString())
  localStorage.setItem('controls.target.z', (cameraControls?.target.z ?? '0').toString())
}

const saveAttachedMeshState = (uuid: string): void => {
  localStorage.setItem('attachedMeshState', uuid)
}

const loadAttachedMeshState = (): void => {
  console.log('loadAttached')
  const loadedMeshState = localStorage.getItem('attachedMeshState')
  if (truthy(loadedMeshState) && truthy(groupRef.value)) {
    const targetMesh = seek(groupRef.value, 'uuid', loadedMeshState)
    choosenMeshRef.value = targetMesh as TresObject3D
  }
}

const raycaster = new Raycaster()
const mouse = new Vector2()

const attachControlPanels = (): void => {
  if (truthy(gui) && falsy(positionFolder) && truthy(choosenMeshRef.value)) {
    positionFolder = gui.addFolder('Position')
    positionFolder.add(choosenMeshRef.value?.position, 'x').min(-10).max(10).step(0.01).listen()
    positionFolder.add(choosenMeshRef.value?.position, 'y').min(-10).max(10).step(0.01).listen()
    positionFolder.add(choosenMeshRef.value?.position, 'z').min(-10).max(10).step(0.01).listen()
  } else {
    positionFolder?.show()
  }
  if (truthy(gui) && falsy(textureFolder)) {
    textureFolder = gui?.addFolder('Textures')
    const textures = sources.filter((source) => source.type === 'texture')
    const textureSubTypeNames = new Set(textures.map((texture) => texture.subtype))
    const controls: TextureInfo = {
      albedo: notChoosetext,
      roughness: notChoosetext,
      metalness: notChoosetext,
      normal: notChoosetext,
      sheen: notChoosetext
    }

    textureSubTypeNames.forEach((subtype) => {
      if (truthy(subtype)) {
        textureFolder?.add(controls, subtype, textures
          .filter((source) => source.subtype === subtype)
          .map((source) => source.name)
        )
          .onChange((event: string) => {
            const meshNameArr = choosenMeshRef.value?.parent?.name.split('|')
            if (truthy(meshNameArr)) {
              const textureInfo = JSON.parse(meshNameArr[2])
              console.log(subtype)
              textureInfo[subtype] = event
              if (truthy(choosenMeshRef.value) && truthy(choosenMeshRef.value.parent)) {
                choosenMeshRef.value.parent.name = [
                  meshNameArr[0],
                  meshNameArr[1],
                  JSON.stringify(textureInfo),
                  meshNameArr[3]].join('|')
              }
            }
            void handleApplyTexture(event)
          })
          .listen()
      }
    })
  } else {
    positionFolder?.controllers.forEach(controller => {
      if (truthy(choosenMeshRef.value?.position)) {
        controller.object = choosenMeshRef.value?.position
      }
    })
    textureFolder?.show()
    textureFolder?.controllers.forEach(controller => {
      const meshNameArr = choosenMeshRef.value?.parent?.name.split('|')
      if (truthy(meshNameArr)) {
        const textureInfo = JSON.parse(meshNameArr[2])
        controller.object = textureInfo
      }
    })
  }
  if (falsy(deleteMeshController) && truthy(gui)) {
    controlValues.removeMesh = (): void => {
      handleDeleteMesh()
    }
    deleteMeshController = gui?.add(controlValues, 'removeMesh').name('Delete')
  }

  if (falsy(presetFolder) && truthy(gui)) {
    const parameters: Record<string, boolean> = {
      isLeather: false,
      isMetal: false,
      isVelours: false,
      isWood: false
    }
    presetFolder = gui?.addFolder('Presets material param')
    presetFolder.add(parameters, 'isLeather').name('Leather').listen().onChange(function () { setChecked('isLeather') })
    presetFolder.add(parameters, 'isMetal').name('Metal').listen().onChange(function () { setChecked('isMetal') })
    presetFolder.add(parameters, 'isVelours').name('Velours').listen().onChange(function () { setChecked('isVelours') })
    presetFolder.add(parameters, 'isWood').name('Wood').listen().onChange(function () { setChecked('isWood') })

    const setLight = (light: Light, intensity: number, color: string, position: Vector3): void => {
      light.intensity = intensity
      light.color = new Color(color)
      light.position.set(position.x, position.y, position.z)
    }

    const setChecked = (prop: string): void => {
      for (const param in parameters) {
        parameters[param] = false
      }
      parameters[prop] = true
      switch (prop) {
        case 'isLeather':
          if (truthy(canvasRef.value)) {
            canvasRef.value.context.renderer.value.toneMappingExposure = 1.447
            canvasRef.value.context.renderer.value.toneMapping = LinearToneMapping
          }
          if (truthy(choosenMeshRef.value?.material)) {
            choosenMeshRef.value.material.color = new Color('#ffffff')
            choosenMeshRef.value.material.roughness = 1
            choosenMeshRef.value.material.metalness = 1
            choosenMeshRef.value.material.reflectivity = 0.5
            choosenMeshRef.value.material.ior = 0
            choosenMeshRef.value.material.iridescence = 0
            choosenMeshRef.value.material.iridescenceIOR = 0
            choosenMeshRef.value.material.sheen = 0
            choosenMeshRef.value.material.sheenRoughness = 0
            choosenMeshRef.value.material.sheenColor = new Color('#ffffff')
            choosenMeshRef.value.material.specularIntensity = 0.5
            choosenMeshRef.value.material.specularColor = new Color('#ffffff')
            choosenMeshRef.value.material.envMapIntensity = 0.3
            choosenMeshRef.value.material.needsUpdate = true
          }
          if (truthy(directionalLightRef.value)) {
            setLight(directionalLightRef.value, 10, '#b4bcd5', new Vector3(-1.19, 0.59, 0.33))
          }
          if (truthy(directionalLightRef2.value)) {
            setLight(directionalLightRef2.value, 1.222, '#525b74', new Vector3(6.44, 3, 4.15))
          }
          if (truthy(ambientLightRef.value)) {
            setLight(ambientLightRef.value, 0, '#ffffff', new Vector3(0, 0, 0))
          }
          break
        case 'isMetal':
          if (truthy(canvasRef.value)) {
            canvasRef.value.context.renderer.value.toneMappingExposure = 1.447
            canvasRef.value.context.renderer.value.toneMapping = ACESFilmicToneMapping
          }
          if (truthy(choosenMeshRef.value?.material)) {
            choosenMeshRef.value.material.color = new Color('#ffffff')
            choosenMeshRef.value.material.roughness = 1
            choosenMeshRef.value.material.metalness = 1
            choosenMeshRef.value.material.reflectivity = 0
            choosenMeshRef.value.material.ior = 0
            choosenMeshRef.value.material.iridescence = 0
            choosenMeshRef.value.material.iridescenceIOR = 0
            choosenMeshRef.value.material.sheen = 0
            choosenMeshRef.value.material.sheenRoughness = 0
            choosenMeshRef.value.material.sheenColor = new Color('#ffffff')
            choosenMeshRef.value.material.specularIntensity = 0.5
            choosenMeshRef.value.material.specularColor = new Color('#ffffff')
            choosenMeshRef.value.material.envMapIntensity = 1
            choosenMeshRef.value.material.needsUpdate = true
          }
          if (truthy(directionalLightRef.value)) {
            setLight(directionalLightRef.value, 0, '#ffffff', new Vector3(0, 0, 0))
          }
          if (truthy(directionalLightRef2.value)) {
            setLight(directionalLightRef2.value, 0, '#ffffff', new Vector3(0, 0, 0))
          }
          if (truthy(ambientLightRef.value)) {
            setLight(ambientLightRef.value, 0, '#ffffff', new Vector3(0, 0, 0))
          }
          break
        case 'isVelours':
          if (truthy(canvasRef.value)) {
            canvasRef.value.context.renderer.value.toneMappingExposure = 3
            canvasRef.value.context.renderer.value.toneMapping = ACESFilmicToneMapping
          }
          if (truthy(choosenMeshRef.value?.material)) {
            choosenMeshRef.value.material.color = new Color('#715656')
            choosenMeshRef.value.material.roughness = 0.57
            choosenMeshRef.value.material.metalness = 0.2
            choosenMeshRef.value.material.reflectivity = 0
            choosenMeshRef.value.material.ior = 0
            choosenMeshRef.value.material.iridescence = 0
            choosenMeshRef.value.material.iridescenceIOR = 0
            choosenMeshRef.value.material.sheen = 0.52
            choosenMeshRef.value.material.sheenRoughness = 0.45
            choosenMeshRef.value.material.sheenColor = new Color('#500202')
            choosenMeshRef.value.material.specularIntensity = 0.5
            choosenMeshRef.value.material.specularColor = new Color('#ffffff')
            choosenMeshRef.value.material.envMapIntensity = 0
            choosenMeshRef.value.material.needsUpdate = true
          }
          if (truthy(directionalLightRef.value)) {
            setLight(directionalLightRef.value, 2.367, '#ffffff', new Vector3(-0.94, 1.1, 1.6))
          }
          if (truthy(directionalLightRef2.value)) {
            setLight(directionalLightRef2.value, 1.35, '#ffffff', new Vector3(5.67, 3, -0.94))
          }
          if (truthy(ambientLightRef.value)) {
            setLight(ambientLightRef.value, 0.5, '#ffffff', new Vector3(0, 0, 0))
          }
          break
        case 'isWood':
          if (truthy(canvasRef.value)) {
            canvasRef.value.context.renderer.value.toneMappingExposure = 1.447
            canvasRef.value.context.renderer.value.toneMapping = ACESFilmicToneMapping
          }
          if (truthy(choosenMeshRef.value?.material)) {
            choosenMeshRef.value.material.color = new Color('#ffffff')
            choosenMeshRef.value.material.roughness = 1
            choosenMeshRef.value.material.metalness = 0
            choosenMeshRef.value.material.ior = 1.45
            choosenMeshRef.value.material.reflectivity = 1
            choosenMeshRef.value.material.iridescence = 0.2
            choosenMeshRef.value.material.iridescenceIOR = 0.08
            choosenMeshRef.value.material.sheen = 0
            choosenMeshRef.value.material.sheenRoughness = 0
            choosenMeshRef.value.material.sheenColor = new Color('#ffffff')
            choosenMeshRef.value.material.specularIntensity = 0.5
            choosenMeshRef.value.material.specularColor = new Color('#ffffff')
            choosenMeshRef.value.material.envMapIntensity = 0.35
            choosenMeshRef.value.material.needsUpdate = true
          }
          if (truthy(directionalLightRef.value)) {
            setLight(directionalLightRef.value, 2.367, '#bb966e', new Vector3(-0.94, 1.1, 1.6))
          }
          if (truthy(directionalLightRef2.value)) {
            setLight(directionalLightRef2.value, 1.35, '#5a4430', new Vector3(5.67, 3, -0.94))
          }
          if (truthy(ambientLightRef.value)) {
            setLight(ambientLightRef.value, 0, '#ffffff', new Vector3(0, 0, 0))
          }
          break
        default:
          break
      }
    }
  }

  if (truthy(gui) && falsy(lightFolder)) {
    lightFolder = gui.addFolder('Light')
    if (truthy(directionalLightRef.value)) {
      lightFolder.add(directionalLightRef.value, 'intensity').min(0).max(10).step(0.001).name('intensity').listen()
      lightFolder.add(directionalLightRef.value?.position, 'x').min(-10).max(10).step(0.01).listen()
      lightFolder.add(directionalLightRef.value?.position, 'y').min(-10).max(10).step(0.01).listen()
      lightFolder.add(directionalLightRef.value?.position, 'z').min(-10).max(10).step(0.01).listen()
      lightFolder.addColor(new ColorGUIHelper(directionalLightRef.value, 'color'), 'value').name('color').listen()
    }
    if (truthy(directionalLightRef2.value)) {
      lightFolder.add(directionalLightRef2.value, 'intensity').min(0).max(10).step(0.001).name('intensity').listen()
      lightFolder.add(directionalLightRef2.value?.position, 'x').min(-10).max(10).step(0.01).listen()
      lightFolder.add(directionalLightRef2.value?.position, 'y').min(-10).max(10).step(0.01).listen()
      lightFolder.add(directionalLightRef2.value?.position, 'z').min(-10).max(10).step(0.01).listen()
      lightFolder.addColor(new ColorGUIHelper(directionalLightRef2.value, 'color'), 'value').name('color').listen()
    }
    if (truthy(ambientLightRef.value)) {
      lightFolder.add(ambientLightRef.value, 'intensity').min(0).max(10).step(0.001).name('intensity').listen()
      lightFolder.addColor(new ColorGUIHelper(ambientLightRef.value, 'color'), 'value').name('color').listen()
    }
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
  const scene = canvasRef.value?.context.scene.value
  scene.environment = environmentMap
  if (truthy(choosenMeshRef.value?.material)) {
    choosenMeshRef.value.material.envMap = environmentMap
  }
}

const handleMouseDown = (event: MouseEvent): void => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  if (truthy(cameraRef.value)) {
    raycaster.setFromCamera(mouse, cameraRef.value)
  }

  const intersects = raycaster.intersectObjects(
    canvasRef.value?.context.scene.value.children as [],
    true
  )

  if (intersects.length > 0) {
    const findRootGroupOfMesh = (intersectObject: Object3D): Object3D | null => {
      let currentNode = intersectObject.parent
      while (truthy(currentNode?.isObject3D) && falsy(currentNode instanceof Group)) {
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
        choosenMeshRef.value = choosenMesh as TresObject3D
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

  if (truthy(renderer)) {
    gui.add(renderer, 'toneMapping', {
      No: NoToneMapping,
      Linear: LinearToneMapping,
      Reinhard: ReinhardToneMapping,
      Cineon: CineonToneMapping,
      ACESFilmic: ACESFilmicToneMapping
    }).name('Tone Mapping')

    gui.add(renderer, 'toneMappingExposure').min(0).max(10).step(0.001).listen().name('Exposure')
  }
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
      void loadRootGroupState()
      loadAttachedMeshState()
    }
  },
  { immediate: true }
)

watch(
  () => canvasRef.value,
  (newValue) => {
    if (truthy(newValue)) {
      renderer = canvasRef.value?.context.renderer.value
      if (truthy(renderer)) {
        const camera: Camera = canvasRef.value?.context.camera.value
        const loadCameraState = (): void => {
          if (localStorage.getItem('camera.position.x') !== null) {
            camera.position.x = parseFloat(localStorage.getItem('camera.position.x') ?? '0')
            camera.position.y = parseFloat(localStorage.getItem('camera.position.y') ?? '0')
            camera.position.z = parseFloat(localStorage.getItem('camera.position.z') ?? '0')

            camera.rotation.x = parseFloat(localStorage.getItem('camera.rotation.x') ?? '0')
            camera.rotation.y = parseFloat(localStorage.getItem('camera.rotation.y') ?? '0')
            camera.rotation.z = parseFloat(localStorage.getItem('camera.rotation.z') ?? '0')

            if (camera instanceof PerspectiveCamera) {
              camera.zoom = parseFloat(localStorage.getItem('camera.zoom') ?? '0')
            }
          }
        }
        loadCameraState()
        cameraControls = new OrbitControls(camera, renderer.domElement)
        if (localStorage.getItem('controls.target.x') !== null) {
          const x = localStorage.getItem('controls.target.x')
          const y = localStorage.getItem('controls.target.y')
          const z = localStorage.getItem('controls.target.z')

          if (x !== null) {
            cameraControls.target.x = parseFloat(x)
          }
          if (y !== null) {
            cameraControls.target.y = parseFloat(y)
          }
          if (z !== null) {
            cameraControls.target.z = parseFloat(z)
          }
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
    <Stats class='stats' />
    <TresPerspectiveCamera
      ref='cameraRef'
    />
    <TransformControls v-log
    ref='transformControlsRef'
    v-if='choosenMeshRef'
    :object='choosenMeshRef'
    v-bind='transformState'
    @mouse-down='() => { if(truthy(cameraControls)) { cameraControls.enabled = false } }'
    @mouse-up='() => { if(truthy(cameraControls)) { cameraControls.enabled = true } }'
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
<style>
  .stats {
    left: 1.5rem;
    top: 1.5rem;
  }
</style>
