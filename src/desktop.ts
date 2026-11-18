export interface TinteroDesktop {
  platform: string
  load: () => string | null
  save: (json: string) => void
  saveSync: (json: string) => boolean
  dataPath: () => Promise<string>
  version: () => Promise<string>
  openDataDir: () => Promise<string>
  setZoom: (factor: number) => void
  windowControl: (action: 'close' | 'minimize' | 'maximize') => void
}

declare global {
  interface Window {
    tinteroDesktop?: TinteroDesktop
  }
}

/** Presente solo cuando la app corre dentro de Electron. */
export const desktop: TinteroDesktop | undefined = window.tinteroDesktop
