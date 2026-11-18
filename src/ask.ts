/** Diálogo de texto propio (Electron no admite window.prompt). */
export function askText(title: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div')
    back.className = 'palette-backdrop ask-backdrop'
    const box = document.createElement('form')
    box.className = 'ask-box'
    const label = document.createElement('label')
    label.textContent = title
    const input = document.createElement('input')
    input.value = initial
    const row = document.createElement('div')
    row.className = 'ask-row'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'btn'
    cancel.textContent = 'Cancelar'
    const ok = document.createElement('button')
    ok.type = 'submit'
    ok.className = 'btn primary'
    ok.textContent = 'Aceptar'
    row.append(cancel, ok)
    box.append(label, input, row)
    back.append(box)
    document.body.append(back)
    input.focus()
    input.select()

    const done = (v: string | null) => {
      back.remove()
      resolve(v && v.trim() ? v.trim() : null)
    }
    box.onsubmit = (e) => {
      e.preventDefault()
      done(input.value)
    }
    cancel.onclick = () => done(null)
    back.onmousedown = (e) => e.target === back && done(null)
    // Sin valor de retorno: devolver false en on* cancelaría la pulsación de cada tecla.
    input.onkeydown = (e) => {
      if (e.key === 'Escape') done(null)
    }
  })
}
