// Configuración global persistida en localStorage
const KEY = 'print3d_config'

export const CONFIG_DEFAULT = {
  // Filamentos
  filamentos: [
    { nombre: 'PLA', densidad: 1.24, precioPorKg: 15000 },
    { nombre: 'PETG', densidad: 1.27, precioPorKg: 18000 },
    { nombre: 'ABS', densidad: 1.05, precioPorKg: 16000 },
    { nombre: 'ASA', densidad: 1.20, precioPorKg: 20000 },
    { nombre: 'TPU', densidad: 1.08, precioPorKg: 25000 },
  ],
  // Electricidad
  watts: 200,
  preciokWh: 120,
  // Máquina
  inversion: 500000,
  vidaUtilHs: 5000,
  // Mano de obra
  valorHora: 2000,
  minutosOperativos: 20,
  // Desperdicio
  desperdicio: 8,
  // Moneda por defecto
  moneda: '$',
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...CONFIG_DEFAULT }
    return { ...CONFIG_DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...CONFIG_DEFAULT }
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}
