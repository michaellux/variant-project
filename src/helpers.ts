import type { DirectionalLight, AmbientLight } from 'three'

interface ColorProperty {
  getHexString: () => string
  set: (hexString: string) => void
}

const createColorPropertyAdapter = (object: DirectionalLight | AmbientLight): ColorProperty => {
  return {
    getHexString: () => {
      return object.color.getHexString()
    },
    set: (hexString: string) => {
      object.color.setHex(parseInt(hexString.replace('#', ''), 16))
    }
  }
}

export class ColorGUIHelper {
  object: ColorProperty
  prop: string

  constructor (object: DirectionalLight | AmbientLight, prop: string) {
    this.object = createColorPropertyAdapter(object)
    this.prop = prop
  }

  get value (): string {
    return `#${this.object.getHexString()}`
  }

  set value (hexString: string) {
    this.object.set(hexString)
  }
}
