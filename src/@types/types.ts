import type { Vector3, Color, Texture, CompressedTexture } from 'three'
export interface Asset {
  name: string
  type: string
  path: string
  subtype?: string
}

export interface TextureMapInfo {
  map: Texture | CompressedTexture | null
  roughnessMap: Texture | CompressedTexture | null
  metalnessMap: Texture | CompressedTexture | null
  normalMap: Texture | CompressedTexture | null
  sheenRoughnessMap: Texture | CompressedTexture | null
}

export interface TextureInfo {
  albedo: string
  roughness: string
  metalness: string
  normal: string
  sheen: string
}

export interface MaterialParams {
  color: Color | string | null
  roughness: number | null
  metalness: number | null
  reflectivity: number | null
  ior: number | null
  iridescence: number | null
  iridescenceIOR: number | null
  envMapIntensity: number | null
  sheen: number | null
  sheenRoughness: number | null
  sheenColor: Color | string | null
  specularIntensity: number | null
  specularColor: Color | string | null
}

export interface MeshInfo {
  position: Vector3
  geometryName: string
  textureInfo: TextureInfo
  materialParams: MaterialParams
}

export interface Light {
  color: Color
  intensity: number
  position: Vector3
}

export interface LightSettings {
  directionalLight: Light | null
  directionalLight2: Light | null
  ambientLight: Light | null
}
