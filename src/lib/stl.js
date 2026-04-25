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
      const ax = dv.getFloat32(o + 12, true), ay = dv.getFloat32(o + 16, true), az = dv.getFloat32(o + 20, true)
      const bx = dv.getFloat32(o + 24, true), by = dv.getFloat32(o + 28, true), bz = dv.getFloat32(o + 32, true)
      const cx = dv.getFloat32(o + 36, true), cy = dv.getFloat32(o + 40, true), cz = dv.getFloat32(o + 44, true)
      verts.push(ax, ay, az, bx, by, bz, cx, cy, cz)
      minX = Math.min(minX, ax, bx, cx); maxX = Math.max(maxX, ax, bx, cx)
      minY = Math.min(minY, ay, by, cy); maxY = Math.max(maxY, ay, by, cy)
      minZ = Math.min(minZ, az, bz, cz); maxZ = Math.max(maxZ, az, bz, cz)
      vol += signedVolTri(ax, ay, az, bx, by, bz, cx, cy, cz)
      tris++
    }
  } else {
    const txt = new TextDecoder().decode(buffer)
    const re = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g
    const pts = []
    let m
    while ((m = re.exec(txt)) !== null) pts.push(+m[1], +m[2], +m[3])
    for (let j = 0; j < pts.length; j += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = pts.slice(j, j + 9)
      verts.push(ax, ay, az, bx, by, bz, cx, cy, cz)
      minX = Math.min(minX, ax, bx, cx); maxX = Math.max(maxX, ax, bx, cx)
      minY = Math.min(minY, ay, by, cy); maxY = Math.max(maxY, ay, by, cy)
      minZ = Math.min(minZ, az, bz, cz); maxZ = Math.max(maxZ, az, bz, cz)
      vol += signedVolTri(ax, ay, az, bx, by, bz, cx, cy, cz)
      tris++
    }
  }

  return {
    verts,
    tris,
    volCm3: Math.abs(vol) / 1000,
    bbox: {
      x: (maxX - minX) / 10,
      y: (maxY - minY) / 10,
      z: (maxZ - minZ) / 10,
    },
    bounds: { minX, minY, minZ, maxX, maxY, maxZ },
  }
}

function signedVolTri(ax, ay, az, bx, by, bz, cx, cy, cz) {
  return (ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by)) / 6
}

// Modelo calibrado con Bambu Studio / Bambu A1 / PLA
// Referencia: Toma Dinámica Freno Karting V2
//   66.64 cm³ → 89.2g → 231min (infill 15%, con soportes)
const DENSIDADES = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.05,
  ASA: 1.20,
  TPU: 1.08,
}

export function calcularCotizacion({ volCm3, params }) {
  const {
    material = 'PLA',
    densidadCustom,
    infill = 20,
    conSoporte = false,
    precioPorKg = 15000,
    desperdicio = 8,
    watts = 200,
    preciokWh = 120,
    usarAmortizacion = true,
    inversion = 500000,
    vidaUtilHs = 5000,
    usarManoObra = true,
    valorHora = 2000,
    minutosOperativos = 20,
    margen = 40,
  } = params

  const density = densidadCustom || DENSIDADES[material] || 1.24
  const fi = Math.pow(infill / 15, 0.3)
  const factorPeso = conSoporte ? 1.08 : 1.00

  const pesoG = volCm3 * density * factorPeso * fi
  const cFilamento = (pesoG / 1000) * precioPorKg * (1 + desperdicio / 100)

  const factorTiempo = conSoporte ? 3.47 : 3.21
  const minutos = volCm3 * factorTiempo * fi + 6
  const horas = minutos / 60

  const cElectricidad = horas * (watts / 1000) * preciokWh
  const cMaquina = usarAmortizacion ? (inversion / vidaUtilHs) * horas : 0
  const cManoObra = usarManoObra ? valorHora * (minutosOperativos / 60) : 0

  const costoTotal = cFilamento + cElectricidad + cMaquina + cManoObra
  const precioFinal = costoTotal / (1 - margen / 100)
  const ganancia = precioFinal - costoTotal

  return {
    pesoG: +pesoG.toFixed(1),
    tiempoMin: Math.round(minutos),
    tiempoStr: minutos < 60
      ? `${Math.round(minutos)} min`
      : `${Math.floor(horas)}h ${Math.round((horas % 1) * 60)}m`,
    cFilamento: Math.round(cFilamento),
    cElectricidad: Math.round(cElectricidad),
    cMaquina: Math.round(cMaquina),
    cManoObra: Math.round(cManoObra),
    costoTotal: Math.round(costoTotal),
    ganancia: Math.round(ganancia),
    precioFinal: Math.round(precioFinal),
    margen,
    material,
    infill,
    conSoporte,
  }
}

export const DENSIDADES_LISTA = Object.entries(DENSIDADES).map(([k, v]) => ({
  value: k,
  label: `${k} (${v} g/cm³)`,
  density: v,
}))
