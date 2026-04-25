// ── STL parser ──────────────────────────────────────────────
export function parseSTL(buffer) {
  const dv = new DataView(buffer)
  const trisCount = dv.getUint32(80, true)
  const isBinary = buffer.byteLength === 84 + trisCount * 50

  const verts = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let vol = 0, tris = 0

  if (isBinary) {
    for (let i = 0; i < trisCount; i++) {
      const o = 84 + i * 50
      const ax = dv.getFloat32(o+12,true), ay = dv.getFloat32(o+16,true), az = dv.getFloat32(o+20,true)
      const bx = dv.getFloat32(o+24,true), by = dv.getFloat32(o+28,true), bz = dv.getFloat32(o+32,true)
      const cx = dv.getFloat32(o+36,true), cy = dv.getFloat32(o+40,true), cz = dv.getFloat32(o+44,true)
      verts.push(ax,ay,az,bx,by,bz,cx,cy,cz)
      minX=Math.min(minX,ax,bx,cx); maxX=Math.max(maxX,ax,bx,cx)
      minY=Math.min(minY,ay,by,cy); maxY=Math.max(maxY,ay,by,cy)
      minZ=Math.min(minZ,az,bz,cz); maxZ=Math.max(maxZ,az,bz,cz)
      vol += svt(ax,ay,az,bx,by,bz,cx,cy,cz); tris++
    }
  } else {
    const txt = new TextDecoder().decode(buffer)
    const re = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g
    const pts = []; let m
    while ((m = re.exec(txt)) !== null) pts.push(+m[1],+m[2],+m[3])
    for (let j = 0; j < pts.length; j += 9) {
      const [ax,ay,az,bx,by,bz,cx,cy,cz] = pts.slice(j,j+9)
      verts.push(ax,ay,az,bx,by,bz,cx,cy,cz)
      minX=Math.min(minX,ax,bx,cx); maxX=Math.max(maxX,ax,bx,cx)
      minY=Math.min(minY,ay,by,cy); maxY=Math.max(maxY,ay,by,cy)
      minZ=Math.min(minZ,az,bz,cz); maxZ=Math.max(maxZ,az,bz,cz)
      vol += svt(ax,ay,az,bx,by,bz,cx,cy,cz); tris++
    }
  }

  return buildResult(verts, tris, vol, minX, maxX, minY, maxY, minZ, maxZ)
}

// ── 3MF parser ──────────────────────────────────────────────
export async function parse3MF(buffer) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)

  // Find the 3D model file
  const modelFile = zip.file(/^3D\/.*\.model$/i)[0]
    || zip.file('3D/3dmodel.model')
    || Object.values(zip.files).find(f => f.name.endsWith('.model'))

  if (!modelFile) throw new Error('No se encontró el modelo 3D dentro del 3MF')

  const xmlText = await modelFile.async('text')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  const verts = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let vol = 0, tris = 0

  const meshes = doc.querySelectorAll('mesh')
  meshes.forEach(mesh => {
    // Parse vertices
    const vertexNodes = mesh.querySelectorAll('vertices vertex')
    const positions = []
    vertexNodes.forEach(v => {
      const x = parseFloat(v.getAttribute('x')) || 0
      const y = parseFloat(v.getAttribute('y')) || 0
      const z = parseFloat(v.getAttribute('z')) || 0
      positions.push([x, y, z])
      minX=Math.min(minX,x); maxX=Math.max(maxX,x)
      minY=Math.min(minY,y); maxY=Math.max(maxY,y)
      minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z)
    })

    // Parse triangles
    const triNodes = mesh.querySelectorAll('triangles triangle')
    triNodes.forEach(tri => {
      const i1 = parseInt(tri.getAttribute('v1'))
      const i2 = parseInt(tri.getAttribute('v2'))
      const i3 = parseInt(tri.getAttribute('v3'))
      if (isNaN(i1)||isNaN(i2)||isNaN(i3)) return
      const [ax,ay,az] = positions[i1] || [0,0,0]
      const [bx,by,bz] = positions[i2] || [0,0,0]
      const [cx,cy,cz] = positions[i3] || [0,0,0]
      verts.push(ax,ay,az,bx,by,bz,cx,cy,cz)
      vol += svt(ax,ay,az,bx,by,bz,cx,cy,cz)
      tris++
    })
  })

  if (tris === 0) throw new Error('El archivo 3MF no contiene geometría válida')
  return buildResult(verts, tris, vol, minX, maxX, minY, maxY, minZ, maxZ)
}

// ── Auto-detect and parse any supported format ───────────────
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const buffer = await file.arrayBuffer()
  if (ext === 'stl') return parseSTL(buffer)
  if (ext === '3mf') return parse3MF(buffer)
  throw new Error(`Formato .${ext} no soportado. Usá STL o 3MF.`)
}

// ── Helpers ──────────────────────────────────────────────────
function svt(ax,ay,az,bx,by,bz,cx,cy,cz) {
  return (ax*(by*cz-bz*cy)+bx*(cy*az-cz*ay)+cx*(ay*bz-az*by))/6
}

function buildResult(verts, tris, vol, minX, maxX, minY, maxY, minZ, maxZ) {
  return {
    verts,
    tris,
    volCm3: Math.abs(vol) / 1000,
    bbox: {
      x: (maxX-minX)/10,
      y: (maxY-minY)/10,
      z: (maxZ-minZ)/10,
    },
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
  }
}
