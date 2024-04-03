import type { Vector3, Color, Texture } from 'three'
export interface Asset {
  name: string
  type: string
  path: string
  subtype?: string
}

export interface TextureMapInfo {
  map: Texture | null
  roughnessMap: Texture | null
  metalnessMap: Texture | null
  normalMap: Texture | null
  sheenRoughnessMap: Texture | null
}

export interface TextureInfo {
  albedo: string
  roughness: string
  metalness: string
  normal: string
  sheen: string
}

export interface MaterialParams {
  color: Color | null
  roughness: number | null
  metalness: number | null
  reflectivity: number | null
  ior: number | null
  iridescence: number | null
  iridescenceIOR: number | null
  envMapIntensity: number | null
  sheen: number | null
  sheenRoughness: number | null
  sheenColor: number | null
  specularIntensity: number | null
  specularColor: Color | null
}

export interface MeshInfo {
  position: Vector3
  rotation: Vector3
  scale: Vector3
  geometryName: string
  textureInfo: TextureInfo
  materialParams: MaterialParams
}
