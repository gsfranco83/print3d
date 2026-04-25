import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion } from '../lib/stl'
import { parseFile } from '../lib/parsers'
import { loadConfig } from '../lib/config'
import STLViewer from '../components/STLViewer'

function nuevaPieza() {
  return {
    id: crypto.randomUUID(),
    stl: null, file: null,
    // Solo los params que cambian por pieza
    params: { materialIdx: 0, infill: 20, conSoporte: false, margen: 40, moneda: null },
    cantidad: 1,
    descuento: 0,
    result: null,
    meta: { nombre: '', notas: '' },
    collapsed: false,
    parsing: false,
    parseError: null,
  }
}

export default function Cotizador() {
  const navigate = useNavigate()
  const [piezas, setPiezas] = useState([nuevaPieza()])
  const [pedidoMeta, setPedidoMeta] = useState({ clienteId: '', operador: '', notas: '' })
  const [clientes, setClientes] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [session, setSession] = useState(null)
  const [cfg, setCfg] = useState(loadConfig)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data || []))
    const op = localStorage.getItem('print3d_operador')
    if (op) setPedidoMeta(m => ({ ...m, operador: op }))
    setCfg(loadConfig())
  }, [])

  const upd = (id, patch) => setPiezas(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  const updParam = (id, k, v) => setPiezas(ps => ps.map(p => p.id === id ? { ...p, params: { ...p.params, [k]: v } } : p))

  async function processFile(id, f) {
    upd(id, { parsing: true, parseError: null, stl: null, result: null })
    try {
      const stl = await parseFile(f)
      const nombre = f.name.replace(/\.(stl|3mf)$/i, '').replace(/_/g, ' ')
      setPiezas(ps => ps.map(p => p.id === id ? {
        ...p, stl, file: f, parsing: false, result: null,
        meta: { ...p.meta, nombre: p.meta.nombre || nombre },
      } : p))
    } catch (e) {
      upd(id, { parsing: false, parseError: e.message })
    }
  }

  function buildFullParams(p) {
    const fil = cfg.filamentos[p.params.materialIdx] || cfg.filamentos[0]
    return {
      material: fil.nombre,
      densidadCustom: fil.densidad,
      precioPorKg: fil.precioPorKg,
      infill: p.params.infill,
      conSoporte: p.params.conSoporte,
      desperdicio: cfg.desperdicio,
      watts: cfg.watts,
      preciokWh: cfg.preciokWh,
      usarAmortizacion: true,
      inversion: cfg.inversion,
      vidaUtilHs: cfg.vidaUtilHs,
      usarManoObra: true,
      valorHora: cfg.valorHora,
      minutosOperativos: cfg.minutosOperativos,
      margen: p.params.margen,
      moneda: p.params.moneda || cfg.moneda,
    }
  }

  function calcularPieza(id) {
    const p = piezas.find(x => x.id === id)
    if (!p?.stl) return
    upd(id, { result: calcularCotizacion({ volCm3: p.stl.volCm3, params: buildFullParams(p) }) })
  }

  function pdc(p) {
    if (!p.result) return null
    const mon = p.params.moneda || cfg.moneda
    const unitario = Math.round(p.result.precioFinal * (1 - p.descuento / 100))
    return { unitario, total: unitario * p.cantidad, moneda: mon }
  }

  const totalPedido = piezas.reduce((s, p) => s + (pdc(p)?.total || 0), 0)
  const todasCalculadas = piezas.length > 0 && piezas.every(p => p.result !== null)
  const fmtMon = (n, mon) => (mon || cfg.moneda) + ' ' + Math.round(n).toLocaleString('es-AR')

  async function guardarTodo() {
    if (!todasCalculadas) return
    setSaving(true); setSaveMsg('')
    try {
      const cotIds = []
      for (const p of piezas) {
        let archivoUrl = null
        if (p.file) {
          const path = `stl/${Date.now()}_${p.file.name}`
          const { error: upErr } = await supabase.storage.from('archivos').upload(path, p.file)
          if (!upErr) {
            const { data } = supabase.storage.from('archivos').getPublicUrl(path)
            archivoUrl = data.publicUrl
          }
        }
        const { data: pieza, error: pErr } = await supabase.from('piezas').insert({
          nombre: p.meta.nombre || 'Sin nombre',
          cliente_id: pedidoMeta.clienteId || null,
          archivo_url: archivoUrl,
          volumen_cm3: p.stl.volCm3,
          dim_x: p.stl.bbox.x, dim_y: p.stl.bbox.y, dim_z: p.stl.bbox.z,
          triangulos: p.stl.tris,
        }).select().single()
        if (pErr) throw pErr

        const pc = pdc(p)
        const fp = buildFullParams(p)
        const { data: cot, error: cErr } = await supabase.from('cotizaciones').insert({
          pieza_id: pieza.id,
          cliente_id: pedidoMeta.clienteId || null,
          operador: pedidoMeta.operador || session?.user?.email,
          notas: p.meta.notas,
          material: p.result.material,
          infill: p.result.infill,
          con_soporte: p.result.conSoporte,
          peso_g: p.result.pesoG,
          tiempo_min: p.result.tiempoMin,
          costo_filamento: p.result.cFilamento,
          costo_electricidad: p.result.cElectricidad,
          costo_maquina: p.result.cMaquina,
          costo_mo: p.result.cManoObra,
          costo_total: p.result.costoTotal,
          margen_pct: p.result.margen,
          precio_final: pc.unitario,
          moneda: fp.moneda,
        }).select().single()
        if (cErr) throw cErr
        cotIds.push({ cotId: cot.id, cantidad: p.cantidad, precioUnitario: pc.unitario, subtotal: pc.total })
      }

      const { data: pedido, error: pedErr } = await supabase.from('pedidos').insert({
        cliente_id: pedidoMeta.clienteId || null,
        notas: pedidoMeta.notas,
        total: totalPedido,
        estado: 'pendiente',
      }).select().single()
      if (pedErr) throw pedErr

      await supabase.from('items_pedido').insert(
        cotIds.map(({ cotId, cantidad, precioUnitario, subtotal }) => ({
          pedido_id: pedido.id, cotizacion_id: cotId,
          cantidad, precio_unitario: precioUnitario, subtotal,
        }))
      )
      setSaveMsg('Pedido creado correctamente')
      setTimeout(() => navigate('/pedidos'), 1200)
    } catch (e) {
      setSaveMsg('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Cotizador</h1><p>Acepta STL y 3MF · Podés agregar varias piezas</p></div>
        <button className="btn btn-primary" onClick={() => setPiezas(ps => [...ps, nuevaPieza()])}>+ Agregar pieza</button>
      </div>

      {/* Datos del pedido */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><h2>Datos del pedido</h2></div>
        <div className="card-body">
          <div className="fields-3">
            <div className="field">
              <label>Cliente</label>
              <select value={pedidoMeta.clienteId} onChange={e => setPedidoMeta(m => ({ ...m, clienteId: e.target.value }))}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Operador</label>
              <input value={pedidoMeta.operador}
                onChange={e => { setPedidoMeta(m => ({ ...m, operador: e.target.value })); localStorage.setItem('print3d_operador', e.target.value) }}
                placeholder="Tu nombre" />
            </div>
            <div className="field">
              <label>Notas del pedido</label>
              <input value={pedidoMeta.notas} onChange={e => setPedidoMeta(m => ({ ...m, notas: e.target.value }))} placeholder="Observaciones generales..." />
            </div>
          </div>
        </div>
      </div>

      {/* Piezas */}
      {piezas.map((p, idx) => (
        <PiezaEditor key={p.id} pieza={p} idx={idx} total={piezas.length} cfg={cfg}
          onFile={f => processFile(p.id, f)}
          onUpdateParam={(k, v) => updParam(p.id, k, v)}
          onUpdate={patch => upd(p.id, patch)}
          onCalc={() => calcularPieza(p.id)}
          onRemove={() => setPiezas(ps => ps.filter(x => x.id !== p.id))}
          pc={pdc(p)} fmtMon={fmtMon}
        />
      ))}

      {/* Resumen */}
      {piezas.some(p => p.result) && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header"><h2>Resumen del pedido</h2></div>
          <div className="card-body">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['Pieza', 'Precio unit.', 'Cant.', 'Desc.', 'Subtotal'].map((h, i) => (
                    <th key={h} style={{ padding: '6px 8px', color: 'var(--text2)', fontSize: 11, textAlign: i === 0 ? 'left' : 'right', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {piezas.filter(p => p.result).map(p => {
                  const pc = pdc(p)
                  return (
                    <tr key={p.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 500 }}>{p.meta.nombre || 'Sin nombre'}</td>
                      <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--text2)' }}>{fmtMon(p.result.precioFinal, pc.moneda)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 8px' }}>{p.cantidad}</td>
                      <td style={{ textAlign: 'right', padding: '8px 8px', color: p.descuento > 0 ? 'var(--teal)' : 'var(--text2)' }}>{p.descuento > 0 ? `-${p.descuento}%` : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 500 }}>{fmtMon(pc.total, pc.moneda)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '0.5px solid var(--border)', paddingTop: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Total del pedido</div>
                <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--purple)' }}>{fmtMon(totalPedido)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={guardarTodo} disabled={saving || !todasCalculadas}>
                  {saving ? 'Guardando...' : 'Guardar y crear pedido'}
                </button>
                {!todasCalculadas && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Calculá todas las piezas primero</div>}
                {saveMsg && <div style={{ fontSize: 12, color: saveMsg.startsWith('Error') ? 'var(--red)' : 'var(--teal)' }}>{saveMsg}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor por pieza ─────────────────────────────────────────
function PiezaEditor({ pieza: p, idx, total, cfg, onFile, onUpdateParam, onUpdate, onCalc, onRemove, pc, fmtMon }) {
  const { stl, params, result, meta, cantidad, descuento, collapsed, parsing, parseError } = p
  const moneda = params.moneda || cfg.moneda

  function handleDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('over')
    const f = e.dataTransfer.files[0]; if (f) onFile(f)
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      {/* Header colapsable */}
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => onUpdate({ collapsed: !collapsed })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>Pieza {idx + 1}</span>
          {meta.nombre && <span style={{ fontWeight: 500 }}>{meta.nombre}</span>}
          {result && pc && <span className="badge badge-purple">{fmtMon(pc.unitario, moneda)} × {cantidad} = {fmtMon(pc.total, moneda)}</span>}
          {parsing && <span className="badge badge-gray">Procesando archivo...</span>}
          {!result && stl && !parsing && <span className="badge badge-amber">Pendiente de calcular</span>}
          {parseError && <span className="badge badge-red">Error al leer archivo</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {total > 1 && <button className="btn btn-sm" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); onRemove() }}>Eliminar</button>}
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="card-body">
          <div className="grid-2">

            {/* Columna izquierda: visor */}
            <div>
              {!stl && !parsing ? (
                <>
                  <div className="drop-zone"
                    onClick={() => document.getElementById(`fi-${p.id}`).click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                    onDragLeave={e => e.currentTarget.classList.remove('over')}
                    onDrop={handleDrop}>
                    <svg width="32" height="32" viewBox="0 0 36 36" fill="none" style={{ margin: '0 auto', opacity: 0.3 }}>
                      <rect x="4" y="8" width="28" height="22" rx="3" stroke="#1a1a18" strokeWidth="1.5"/>
                      <path d="M4 14h28M18 20v8M15 23l3-3 3 3" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p>Arrastrá STL o 3MF acá, o hacé clic</p>
                    <p style={{ fontSize: 11, marginTop: 4, color: 'var(--text2)' }}>Formatos soportados: .stl · .3mf</p>
                    <input id={`fi-${p.id}`} type="file" accept=".stl,.3mf" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files[0]; if (f) onFile(f) }} />
                  </div>
                  {parseError && <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>{parseError}</div>}
                </>
              ) : parsing ? (
                <div style={{ height: 260, background: '#1a1a18', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Procesando archivo...</span>
                </div>
              ) : (
                <>
                  <STLViewer verts={stl.verts} bounds={stl.bounds} />
                  <div className="stats-grid" style={{ marginTop: 10 }}>
                    <div className="stat-card"><div className="stat-label">Volumen</div><div className="stat-val" style={{ fontSize: 15 }}>{stl.volCm3.toFixed(2)} cm³</div></div>
                    <div className="stat-card"><div className="stat-label">Dims (cm)</div><div className="stat-val" style={{ fontSize: 12 }}>{stl.bbox.x.toFixed(1)}×{stl.bbox.y.toFixed(1)}×{stl.bbox.z.toFixed(1)}</div></div>
                    {result && <><div className="stat-card"><div className="stat-label">Peso</div><div className="stat-val accent" style={{ fontSize: 15 }}>{result.pesoG} g</div></div>
                    <div className="stat-card"><div className="stat-label">Tiempo</div><div className="stat-val" style={{ fontSize: 15 }}>{result.tiempoStr}</div></div></>}
                  </div>
                  <button className="btn btn-sm" style={{ marginTop: 8 }}
                    onClick={() => onUpdate({ stl: null, file: null, result: null, parseError: null })}>
                    Cambiar archivo
                  </button>
                </>
              )}
            </div>

            {/* Columna derecha: parámetros simplificados */}
            <div>
              <div className="field">
                <label>Nombre de la pieza</label>
                <input value={meta.nombre} onChange={e => onUpdate({ meta: { ...meta, nombre: e.target.value } })} placeholder="Nombre descriptivo" />
              </div>
              <div className="field">
                <label>Notas</label>
                <input value={meta.notas} onChange={e => onUpdate({ meta: { ...meta, notas: e.target.value } })} placeholder="Color, acabado, etc." />
              </div>

              <div className="st">Cantidad y descuento</div>
              <div className="fields-2">
                <div className="field">
                  <label>Unidades</label>
                  <input type="number" min="1" value={cantidad}
                    onChange={e => onUpdate({ cantidad: Math.max(1, +e.target.value), result: null })} />
                </div>
                <div className="field">
                  <label>Descuento por volumen (%)</label>
                  <input type="number" min="0" max="80" value={descuento}
                    onChange={e => onUpdate({ descuento: Math.min(80, Math.max(0, +e.target.value)) })} />
                </div>
              </div>

              {result && pc && (
                <div style={{ background: 'var(--purple-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--purple-dark)' }}>Precio unitario{descuento > 0 ? ` (−${descuento}%)` : ''}</span>
                    <span style={{ fontWeight: 500, color: 'var(--purple-dark)' }}>{fmtMon(pc.unitario, moneda)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                    <span style={{ color: 'var(--purple-dark)' }}>Subtotal ({cantidad} u.)</span>
                    <span style={{ fontWeight: 500, color: 'var(--purple-dark)' }}>{fmtMon(pc.total, moneda)}</span>
                  </div>
                </div>
              )}

              <div className="st">Parámetros de impresión</div>

              {/* Info: valores que vienen de configuración */}
              <div style={{ background: 'var(--surface2)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--text2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Electricidad</span>
                  <span>{cfg.watts}W · ${cfg.preciokWh}/kWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Amortización</span>
                  <span>${Math.round(cfg.inversion / cfg.vidaUtilHs)}/h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mano de obra</span>
                  <span>${cfg.valorHora.toLocaleString('es-AR')}/h · {cfg.minutosOperativos} min</span>
                </div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '0.5px solid var(--border)', color: 'var(--purple)', fontSize: 11 }}>
                  Estos valores se configuran en → Configuración
                </div>
              </div>

              {/* Solo los que cambian por pieza */}
              <div className="field">
                <label>Material</label>
                <select value={params.materialIdx} onChange={e => onUpdateParam('materialIdx', +e.target.value)}>
                  {cfg.filamentos.map((f, i) => (
                    <option key={i} value={i}>{f.nombre} — ${f.precioPorKg.toLocaleString('es-AR')}/kg</option>
                  ))}
                </select>
              </div>

              <div className="fields-2">
                <div className="field">
                  <label>Infill (%)</label>
                  <input type="number" min="1" max="100" step="5" value={params.infill}
                    onChange={e => onUpdateParam('infill', +e.target.value)} />
                </div>
                <div className="field">
                  <label>Margen (%)</label>
                  <input type="number" min="0" max="99" value={params.margen}
                    onChange={e => onUpdateParam('margen', +e.target.value)} />
                </div>
              </div>

              <div className="fields-2">
                <div className="field">
                  <label>Moneda</label>
                  <select value={params.moneda || cfg.moneda} onChange={e => onUpdateParam('moneda', e.target.value)}>
                    <option value="$">$ (ARS)</option>
                    <option value="USD">USD</option>
                    <option value="€">€</option>
                  </select>
                </div>
                <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div className="toggle-row" style={{ width: '100%', marginBottom: 0 }}>
                    <span className="toggle-label" style={{ fontSize: 12 }}>Tiene soportes</span>
                    <label className="tog">
                      <input type="checkbox" checked={params.conSoporte} onChange={e => onUpdateParam('conSoporte', e.target.checked)} />
                      <span className="tslider" />
                    </label>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary btn-full" disabled={!stl || parsing} onClick={onCalc} style={{ marginTop: 8 }}>
                {parsing ? 'Procesando...' : stl ? (result ? 'Recalcular' : 'Calcular precio') : 'Cargar archivo primero'}
              </button>

              {/* Desglose de costos */}
              {result && (
                <div style={{ marginTop: 12 }}>
                  <div className="st">Desglose de costos</div>
                  {[
                    [`Filamento (${result.pesoG}g · ${params.infill}%${params.conSoporte ? ' · soportes' : ''})`, result.cFilamento],
                    [`Electricidad (~${result.tiempoStr})`, result.cElectricidad],
                    ['Amortización máquina', result.cMaquina],
                    ['Mano de obra', result.cManoObra],
                    [`Ganancia (${params.margen}%)`, result.ganancia],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>{label}</span>
                      <span style={{ fontWeight: 500 }}>{fmtMon(val, moneda)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 500, borderTop: '0.5px solid var(--border)', marginTop: 4 }}>
                    <span>Costo base</span><span>{fmtMon(result.costoTotal, moneda)}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
