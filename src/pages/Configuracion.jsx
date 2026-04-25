import { useState, useEffect } from 'react'
import { loadConfig, saveConfig, CONFIG_DEFAULT } from '../lib/config'

export default function Configuracion() {
  const [cfg, setCfg] = useState(loadConfig)
  const [saved, setSaved] = useState(false)

  function update(patch) { setCfg(c => ({ ...c, ...patch })); setSaved(false) }

  function updateFilamento(i, patch) {
    const fils = cfg.filamentos.map((f, j) => j === i ? { ...f, ...patch } : f)
    update({ filamentos: fils })
  }

  function addFilamento() {
    update({ filamentos: [...cfg.filamentos, { nombre: 'Nuevo', densidad: 1.24, precioPorKg: 15000 }] })
  }

  function removeFilamento(i) {
    if (cfg.filamentos.length <= 1) return
    update({ filamentos: cfg.filamentos.filter((_, j) => j !== i) })
  }

  function guardar() {
    saveConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function resetear() {
    if (!confirm('¿Restaurar todos los valores por defecto?')) return
    setCfg({ ...CONFIG_DEFAULT })
    saveConfig(CONFIG_DEFAULT)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p>Estos valores se usan automáticamente en cada cotización</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={resetear}>Restaurar defaults</button>
          <button className="btn btn-primary" onClick={guardar}>
            {saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Filamentos */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h2>Filamentos</h2>
          <button className="btn btn-sm" onClick={addFilamento}>+ Agregar</button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Estos materiales aparecen en el selector del cotizador con sus precios actualizados.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Material', 'Densidad (g/cm³)', 'Precio ($/kg)', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfg.filamentos.map((f, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={f.nombre} onChange={e => updateFilamento(i, { nombre: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', border: '0.5px solid var(--border2)', borderRadius: 6, fontSize: 13, background: 'var(--surface2)' }} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input type="number" step="0.01" min="0.5" max="3" value={f.densidad}
                      onChange={e => updateFilamento(i, { densidad: +e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', border: '0.5px solid var(--border2)', borderRadius: 6, fontSize: 13, background: 'var(--surface2)' }} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input type="number" min="0" step="100" value={f.precioPorKg}
                      onChange={e => updateFilamento(i, { precioPorKg: +e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', border: '0.5px solid var(--border2)', borderRadius: 6, fontSize: 13, background: 'var(--surface2)' }} />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <button className="btn btn-sm" style={{ color: 'var(--red)' }}
                      onClick={() => removeFilamento(i)} disabled={cfg.filamentos.length <= 1}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Electricidad */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><h2>Electricidad</h2></div>
        <div className="card-body">
          <div className="fields-2">
            <div className="field">
              <label>Consumo de la impresora (W)</label>
              <input type="number" min="0" step="10" value={cfg.watts} onChange={e => update({ watts: +e.target.value })} />
              <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, display: 'block' }}>Bambu A1 ≈ 200W en operación normal</span>
            </div>
            <div className="field">
              <label>Precio del kWh ($)</label>
              <input type="number" min="0" step="5" value={cfg.preciokWh} onChange={e => update({ preciokWh: +e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* Máquina */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><h2>Amortización de la máquina</h2></div>
        <div className="card-body">
          <div className="fields-2">
            <div className="field">
              <label>Inversión total ($)</label>
              <input type="number" min="0" step="1000" value={cfg.inversion} onChange={e => update({ inversion: +e.target.value })} />
            </div>
            <div className="field">
              <label>Vida útil estimada (horas)</label>
              <input type="number" min="100" step="100" value={cfg.vidaUtilHs} onChange={e => update({ vidaUtilHs: +e.target.value })} />
              <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, display: 'block' }}>
                Costo/hora: ${Math.round(cfg.inversion / cfg.vidaUtilHs).toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mano de obra */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><h2>Mano de obra</h2></div>
        <div className="card-body">
          <div className="fields-2">
            <div className="field">
              <label>Valor hora ($)</label>
              <input type="number" min="0" step="100" value={cfg.valorHora} onChange={e => update({ valorHora: +e.target.value })} />
            </div>
            <div className="field">
              <label>Tiempo operativo por pieza (min)</label>
              <input type="number" min="0" step="5" value={cfg.minutosOperativos} onChange={e => update({ minutosOperativos: +e.target.value })} />
              <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, display: 'block' }}>
                Preparación + extracción + post-proceso
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Otros */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><h2>Otros parámetros</h2></div>
        <div className="card-body">
          <div className="fields-2">
            <div className="field">
              <label>% desperdicio por defecto</label>
              <input type="number" min="0" max="50" step="1" value={cfg.desperdicio} onChange={e => update({ desperdicio: +e.target.value })} />
              <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, display: 'block' }}>Material perdido por fallas / purga</span>
            </div>
            <div className="field">
              <label>Moneda por defecto</label>
              <select value={cfg.moneda} onChange={e => update({ moneda: e.target.value })}>
                <option value="$">$ (ARS)</option>
                <option value="USD">USD</option>
                <option value="€">€</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={guardar} style={{ minWidth: 160 }}>
          {saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
