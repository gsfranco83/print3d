import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const H = 260  // altura fija, nunca cambia

export default function STLViewer({ verts, bounds }) {
  const canvasRef = useRef()
  const wrapRef = useRef()
  const stateRef = useRef({})

  useEffect(() => {
    if (!verts || !bounds) return
    const wrap = wrapRef.current
    const canvas = canvasRef.current

    // Leer ancho ANTES de que el canvas tenga tamaño (evita loop)
    const W = wrap.getBoundingClientRect().width || 400

    const { renderer: oldRen, animId: oldId } = stateRef.current
    if (oldRen) { cancelAnimationFrame(oldId); oldRen.dispose() }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 10000)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(W, H, false)   // false = no tocar style del canvas
    renderer.setClearColor(0x0a0c12)

    // Fijar tamaño del canvas via style explícito para cortar el loop
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    canvas.style.display = 'block'

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    geo.computeVertexNormals()
    const mat = new THREE.MeshPhongMaterial({ color: 0x7C6FE0, specular: 0x333355, shininess: 40 })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds
    mesh.position.set(-(minX + maxX) / 2, -(minY + maxY) / 2, -(minZ + maxZ) / 2)
    const sz = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
    camera.position.set(0, 0, sz * 1.8)

    scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    const dl = new THREE.DirectionalLight(0xffffff, 0.9)
    dl.position.set(1, 2, 3); scene.add(dl)
    const dl2 = new THREE.DirectionalLight(0x8888ff, 0.25)
    dl2.position.set(-1, -1, -1); scene.add(dl2)

    let drag = false, lx = 0, ly = 0, rx = 0, ry = 0, auto = true
    const onDown  = e => { auto = false; drag = true; lx = e.clientX; ly = e.clientY }
    const onUp    = () => { drag = false }
    const onMove  = e => {
      if (!drag) return
      ry += (e.clientX - lx) * 0.01; rx += (e.clientY - ly) * 0.01
      lx = e.clientX; ly = e.clientY; mesh.rotation.set(rx, ry, 0)
    }
    const onWheel = e => { camera.position.z = Math.max(10, camera.position.z + e.deltaY * 0.5); e.preventDefault() }

    let tDown = false, tx = 0, ty = 0
    const onTStart = e => { auto = false; tDown = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY }
    const onTEnd   = () => { tDown = false }
    const onTMove  = e => {
      if (!tDown) return
      ry += (e.touches[0].clientX - tx) * 0.01; rx += (e.touches[0].clientY - ty) * 0.01
      tx = e.touches[0].clientX; ty = e.touches[0].clientY
      mesh.rotation.set(rx, ry, 0); e.preventDefault()
    }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTStart, { passive: true })
    canvas.addEventListener('touchend', onTEnd)
    canvas.addEventListener('touchmove', onTMove, { passive: false })
    window.addEventListener('mouseup', onUp)

    // ResizeObserver seguro: solo actualiza ANCHO, altura siempre fija
    let roActive = true
    const ro = new ResizeObserver(entries => {
      if (!roActive) return
      const nW = entries[0]?.contentRect?.width
      if (!nW || nW <= 0 || !renderer) return
      renderer.setSize(nW, H, false)
      canvas.style.width = nW + 'px'
      canvas.style.height = H + 'px'
      camera.aspect = nW / H
      camera.updateProjectionMatrix()
    })
    ro.observe(wrap)

    let animId
    const loop = () => {
      animId = requestAnimationFrame(loop)
      if (auto) mesh.rotation.y += 0.008
      renderer.render(scene, camera)
    }
    loop()

    stateRef.current = { renderer, animId, ro }

    return () => {
      roActive = false
      ro.disconnect()
      cancelAnimationFrame(animId)
      renderer.dispose()
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTStart)
      canvas.removeEventListener('touchend', onTEnd)
      canvas.removeEventListener('touchmove', onTMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [verts, bounds])

  return (
    <div
      ref={wrapRef}
      className="viewer-wrap"
      style={{ height: H + 'px', overflow: 'hidden' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div className="viewer-hint">clic+arrastrar · scroll zoom</div>
    </div>
  )
}
