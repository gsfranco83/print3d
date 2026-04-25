import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parseFile } from '../lib/parsers'
import STLViewer from '../components/STLViewer'

export default function Biblioteca() {
  const [piezas, setPiezas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)   // pieza seleccionada para panel derecho
  const [stlData, setStlData] = useState(null)      // datos STL de la pieza seleccionada
  const [loadingStl, setLoadingStl] = useState(false)
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchPiezas() }, [])

  async function fetchPiezas() {
    setLoading(true)
    const { data } = await supabase
      .from('piezas')
      .select('*, clientes(nombre), cotizaciones(precio_final, moneda, material, infill, created_at)')
      .order('created_at', { ascending: false })
    setPiezas(data || [])
    setLoading(false)
  }

  async function selectPieza(pieza) {
    setSelected(pieza)
    setStlData(null)
    if (pieza.archivo_url) {
      setLoadingStl(true)
      try {
        const res = await fetch(pieza.archivo_url)
        const blob = await res.blob()
        const ext = pieza.archivo_url.split('.').pop().split('?')[0].toLowerCase()
        const file = new File([blob], `modelo.${ext || 'stl'}`)
        const parsed = await parseFile(file)
        setStlData(parsed)
      } catch (e) {
        console.error('Error cargando archivo:', e)
      } finally {
        setLoadingStl(false)
      }
    }
  }

  async function subirArchivoManual(pieza, file) {
    setUploading(true)
    try {
      const path = `stl/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('archivos').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('archivos').getPublicUrl(path)
      await supabase.from('piezas').update({ archivo_url: data.publicUrl }).eq('id', pieza.id)
      await fetchPiezas()
      // Re-select with updated data
      setSelected(p => ({ ...p, archivo_url: data.publicUrl }))
    } catch (e) {
      alert('Error al subir: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  function descargar(pieza) {
    if (!pieza.archivo_url) return
    const a = document.createElement('a')
    a.href = pieza.archivo_url
    a.download = pieza.nombre + '.stl'
    a.click()
  }

  async function guardarLocal(pieza) {
    if (!pieza.archivo_url) return
    try {
      const res = await fetch(pieza.archivo_url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = pieza.archivo_url.split('.').pop().split('?')[0] || 'stl'
      a.download = `${pieza.nombre}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      alert('Error al descargar: ' + e.message)
    }
  }

  const filtered = piezas.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.clientes?.nombre?.toLowerCase().includes(search.toLowerCase())
  )

  const lastCot = selected?.cotizaciones?.[0]
  const fmtMon = (n, m) => (m || '$') + ' ' + Math.round(n).toLocaleString('es-AR')

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

      {/* Lista de piezas */}
      <div style={{ flex: selected ? '0 0 340px' : '1' }}>
        <div className="page-header">
          <div><h1>Biblioteca</h1><p>{piezas.length} piezas guardadas</p></div>
          <button className="btn btn-primary" onClick={() => navigate('/cotizador')}>+ Nueva pieza</button>
        </div>

        <input
          style={{ width: '100%', padding: '8px 12px', marginBottom: 12, border: '0.5px solid var(--border2)', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14 }}
          placeholder="Buscar por nombre o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="empty-state"><p>Cargando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No hay piezas todavía.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/cotizador')}>Cotizá tu primera pieza</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => (
              <PiezaRow key={p.id} pieza={p} selected={selected?.id === p.id} onClick={() => selected?.id === p.id ? setSelected(null) : selectPieza(p)} />
            ))}
          </div>
        )}
      </div>

      {/* Panel derecho: detalle de pieza */}
      {selected && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ position: 'sticky', top: '1rem' }}>
            <div className="card-header">
              <h2>{selected.nombre}</h2>
              <button className="btn btn-sm" onClick={() => { setSelected(null); setStlData(null) }}>✕ Cerrar</button>
            </div>
            <div className="card-body">

              {/* Visor 3D */}
              {selected.archivo_url ? (
                loadingStl ? (
                  <div style={{ height: 240, background: '#0a0c12', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid var(--border)' }}>
                    <span style={{ color: 'var(--text2)', fontSize: 13 }}>Cargando modelo 3D...</span>
                  </div>
                ) : stlData ? (
                  <STLViewer verts={stlData.verts} bounds={stlData.bounds} />
                ) : (
                  <div style={{ height: 240, background: '#0a0c12', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid var(--border)' }}>
                    <span style={{ color: 'var(--text2)', fontSize: 13 }}>No se pudo cargar el modelo</span>
                  </div>
                )
              ) : (
                <div className="drop-zone" style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => document.getElementById('upload-manual').click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                  onDragLeave={e => e.currentTarget.classList.remove('over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) subirArchivoManual(selected, f) }}>
                  <p style={{ fontSize: 13 }}>{uploading ? 'Subiendo...' : 'Sin archivo · Arrastrá STL/3MF para vincular'}</p>
                  <input id="upload-manual" type="file" accept=".stl,.3mf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files[0]; if (f) subirArchivoManual(selected, f) }} />
                </div>
              )}

              {/* Stats */}
              <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat-card"><div className="stat-label">Volumen</div><div className="stat-val" style={{ fontSize: 15 }}>{selected.volumen_cm3?.toFixed(2)} cm³</div></div>
                <div className="stat-card"><div className="stat-label">Dimensiones (cm)</div><div className="stat-val" style={{ fontSize: 12 }}>{selected.dim_x?.toFixed(1)}×{selected.dim_y?.toFixed(1)}×{selected.dim_z?.toFixed(1)}</div></div>
                <div className="stat-card"><div className="stat-label">Triángulos</div><div className="stat-val" style={{ fontSize: 15 }}>{selected.tris?.toLocaleString('es-AR') || '—'}</div></div>
                <div className="stat-card"><div className="stat-label">Cliente</div><div className="stat-val" style={{ fontSize: 14 }}>{selected.clientes?.nombre || '—'}</div></div>
              </div>

              {/* Última cotización */}
              {lastCot && (
                <div style={{ marginTop: 12, background: 'var(--purple-light)', border: '0.5px solid var(--purple)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--purple-dark)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Última cotización</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lastCot.material} · infill {lastCot.infill}%</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{new Date(lastCot.created_at).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--purple-dark)' }}>{fmtMon(lastCot.precio_final, lastCot.moneda)}</div>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.archivo_url && (
                  <button className="btn btn-full" onClick={() => guardarLocal(selected)}>
                    ↓ Descargar archivo ({selected.archivo_url.split('.').pop().split('?')[0].toUpperCase()})
                  </button>
                )}
                <button className="btn btn-primary btn-full" onClick={() => navigate('/cotizador')}>
                  Recotizar esta pieza
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PiezaRow({ pieza, selected, onClick }) {
  const lastCot = pieza.cotizaciones?.[0]
  const fmtMon = (n, m) => (m || '$') + ' ' + Math.round(n).toLocaleString('es-AR')

  return (
    <div onClick={onClick} style={{
      background: selected ? 'var(--surface2)' : 'var(--surface)',
      border: selected ? '0.5px solid var(--purple)' : '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '12px 14px',
      cursor: 'pointer',
      transition: '.12s',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* Ícono de archivo */}
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: pieza.archivo_url ? 'var(--purple-light)' : 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '0.5px solid var(--border)',
        }}>
          {pieza.archivo_url ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--purple-dark)" strokeWidth="1.2">
              <path d="M8 2L2 5v6l6 3 6-3V5L8 2z"/>
              <path d="M2 5l6 3 6-3M8 8v5"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text2)" strokeWidth="1.2">
              <rect x="3" y="1" width="10" height="14" rx="1.5"/>
              <path d="M6 5h4M6 8h4M6 11h2"/>
            </svg>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pieza.nombre}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
            {pieza.clientes?.nombre && <span>{pieza.clientes.nombre} · </span>}
            {pieza.volumen_cm3?.toFixed(1)} cm³
            {!pieza.archivo_url && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>sin archivo</span>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {lastCot && <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--purple-dark)' }}>{fmtMon(lastCot.precio_final, lastCot.moneda)}</div>}
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{new Date(pieza.created_at).toLocaleDateString('es-AR')}</div>
      </div>
    </div>
  )
}
