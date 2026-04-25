import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ESTADOS = ['pendiente', 'confirmado', 'produccion', 'listo', 'entregado']
const ESTADO_LABELS = { pendiente: 'Pendiente', confirmado: 'Confirmado', produccion: 'En producción', listo: 'Listo', entregado: 'Entregado' }

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [clientes, setClientes] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [form, setForm] = useState({ cliente_id: '', notas: '', fecha_entrega: '', items: [{ cotizacion_id: '', cantidad: 1 }] })
  const [saving, setSaving] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    fetchPedidos()
    supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('cotizaciones').select('id, precio_final, moneda, piezas(nombre)').order('created_at', { ascending: false }).then(({ data }) => setCotizaciones(data || []))
  }, [])

  async function fetchPedidos() {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre), items_pedido(*, cotizaciones(precio_final, moneda, piezas(nombre)))')
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('pedidos').update({ estado }).eq('id', id)
    setPedidos(ps => ps.map(p => p.id === id ? { ...p, estado } : p))
  }

  async function guardarPedido() {
    setSaving(true)
    try {
      const itemsValidos = form.items.filter(i => i.cotizacion_id)
      const cots = cotizaciones.filter(c => itemsValidos.find(i => i.cotizacion_id === c.id))
      const total = itemsValidos.reduce((sum, item) => {
        const cot = cots.find(c => c.id === item.cotizacion_id)
        return sum + (cot ? cot.precio_final * item.cantidad : 0)
      }, 0)

      const { data: pedido, error } = await supabase.from('pedidos').insert({
        cliente_id: form.cliente_id || null,
        notas: form.notas,
        fecha_entrega_estimada: form.fecha_entrega || null,
        total: Math.round(total),
        estado: 'pendiente',
      }).select().single()
      if (error) throw error

      const items = itemsValidos.map(item => {
        const cot = cots.find(c => c.id === item.cotizacion_id)
        return {
          pedido_id: pedido.id,
          cotizacion_id: item.cotizacion_id,
          cantidad: item.cantidad,
          precio_unitario: cot?.precio_final || 0,
          subtotal: (cot?.precio_final || 0) * item.cantidad,
        }
      })
      await supabase.from('items_pedido').insert(items)
      setShowForm(false)
      fetchPedidos()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = filtroEstado === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtroEstado)

  return (
    <div>
      <div className="page-header">
        <div><h1>Pedidos</h1><p>{pedidos.length} pedidos en total</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuevo pedido</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['todos', ...ESTADOS].map(e => (
          <button key={e} className={'btn btn-sm' + (filtroEstado === e ? ' btn-primary' : '')} onClick={() => setFiltroEstado(e)}>
            {e === 'todos' ? 'Todos' : ESTADO_LABELS[e]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header"><h2>Nuevo pedido</h2><button className="btn btn-sm" onClick={() => setShowForm(false)}>Cancelar</button></div>
          <div className="card-body">
            <div className="fields-2">
              <div className="field">
                <label>Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Fecha de entrega estimada</label>
                <input type="date" value={form.fecha_entrega} onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} />
              </div>
            </div>

            <div className="st">Piezas del pedido</div>
            {form.items.map((item, i) => (
              <div key={i} className="fields-2" style={{ marginBottom: 8 }}>
                <div className="field">
                  <label>Cotización</label>
                  <select value={item.cotizacion_id} onChange={e => setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, cotizacion_id: e.target.value } : it) }))}>
                    <option value="">Seleccionar cotización</option>
                    {cotizaciones.map(c => <option key={c.id} value={c.id}>{c.piezas?.nombre} — {c.moneda} {Math.round(c.precio_final).toLocaleString('es-AR')}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Cantidad</label>
                  <input type="number" min="1" value={item.cantidad} onChange={e => setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, cantidad: +e.target.value } : it) }))} />
                </div>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, { cotizacion_id: '', cantidad: 1 }] }))}>+ Agregar pieza</button>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Instrucciones, observaciones..." />
            </div>
            <button className="btn btn-primary" onClick={guardarPedido} disabled={saving}>{saving ? 'Guardando...' : 'Crear pedido'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="empty-state"><p>Cargando...</p></div> :
        filtered.length === 0 ? <div className="empty-state"><p>No hay pedidos {filtroEstado !== 'todos' ? `con estado "${ESTADO_LABELS[filtroEstado]}"` : 'todavía'}.</p></div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => <PedidoCard key={p.id} pedido={p} cambiarEstado={cambiarEstado} estadoLabels={ESTADO_LABELS} estados={ESTADOS} />)}
        </div>
      }
    </div>
  )
}

function PedidoCard({ pedido, cambiarEstado, estadoLabels, estados }) {
  const estadoIdx = estados.indexOf(pedido.estado)
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{pedido.clientes?.nombre || 'Sin cliente'}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {new Date(pedido.created_at).toLocaleDateString('es-AR')}
              {pedido.fecha_entrega_estimada && ` · Entrega: ${new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-AR')}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`badge badge-${pedido.estado === 'entregado' ? 'green' : pedido.estado === 'listo' ? 'teal' : pedido.estado === 'produccion' ? 'purple' : pedido.estado === 'confirmado' ? 'amber' : 'gray'}`}>
              {estadoLabels[pedido.estado]}
            </span>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--purple)', marginTop: 4 }}>$ {Math.round(pedido.total || 0).toLocaleString('es-AR')}</div>
          </div>
        </div>

        {pedido.items_pedido?.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)' }}>
            {pedido.items_pedido.map((item, i) => (
              <span key={i}>{item.cotizaciones?.piezas?.nombre}{item.cantidad > 1 ? ` ×${item.cantidad}` : ''}{i < pedido.items_pedido.length - 1 ? ', ' : ''}</span>
            ))}
          </div>
        )}

        {pedido.notas && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>{pedido.notas}</div>}

        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {estados.map((e, i) => (
            <button key={e}
              className={'btn btn-sm' + (pedido.estado === e ? ' btn-primary' : '')}
              disabled={pedido.estado === e}
              onClick={() => cambiarEstado(pedido.id, e)}>
              {i + 1}. {estadoLabels[e]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
