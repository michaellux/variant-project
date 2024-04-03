import type { Vector3, Color } from 'three'

export interface Asset {
  name: string
  type: string
  path: string
  subtype?: string
}

export interface TextureInfo {
  albedo: string
  roughness: string
  metalness: string
  normal: string
  sheen: string
}

export interface MaterialParams {
  color: Color
  roughness: number
  metalness: number
  reflectivity: number
  ior: number
  iridescence: number
  iridescenceIOR: number
  envMapIntensity: number
  sheen: number
  sheenRoughness: number
  sheenColor: number
  specularIntensity: number
  specularColor: Color
}

export interface MeshInfo {
  position: Vector3
  rotation: Vector3
  scale: Vector3
  geometryName: string
  textureInfo: TextureInfo
  materialParams: MaterialParams
}
