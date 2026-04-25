import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ESTADO_LABELS = { pendiente: 'Pendiente', confirmado: 'Confirmado', produccion: 'En producción', listo: 'Listo', entregado: 'Entregado' }
const ESTADO_BADGE = { pendiente: 'gray', confirmado: 'amber', produccion: 'purple', listo: 'teal', entregado: 'green' }

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [pedidosRecientes, setPedidosRecientes] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ data: pedidos }, { data: cotizaciones }, { data: piezas }, { data: clientes }] = await Promise.all([
        supabase.from('pedidos').select('estado, total'),
        supabase.from('cotizaciones').select('precio_final, costo_total, created_at'),
        supabase.from('piezas').select('id'),
        supabase.from('clientes').select('id'),
      ])

      const hoy = new Date()
      const mesActual = cotizaciones?.filter(c => {
        const d = new Date(c.created_at)
        return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
      }) || []

      const ingresosMes = mesActual.reduce((s, c) => s + (c.precio_final || 0), 0)
      const costosMes = mesActual.reduce((s, c) => s + (c.costo_total || 0), 0)
      const gananciasMes = ingresosMes - costosMes

      const enProduccion = pedidos?.filter(p => p.estado === 'produccion').length || 0
      const listos = pedidos?.filter(p => p.estado === 'listo').length || 0
      const pendientes = pedidos?.filter(p => p.estado === 'pendiente' || p.estado === 'confirmado').length || 0

      setStats({
        ingresosMes, costosMes, gananciasMes,
        margenMes: ingresosMes > 0 ? Math.round((gananciasMes / ingresosMes) * 100) : 0,
        cotizacionesMes: mesActual.length,
        enProduccion, listos, pendientes,
        totalPiezas: piezas?.length || 0,
        totalClientes: clientes?.length || 0,
      })

      const { data: recientes } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre)')
        .order('created_at', { ascending: false })
        .limit(5)
      setPedidosRecientes(recientes || [])
    }
    load()
  }, [])

  const fmt = n => '$ ' + Math.round(n).toLocaleString('es-AR')

  if (!stats) return <div className="empty-state"><p>Cargando dashboard...</p></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Ingresos del mes</div>
          <div className="stat-val accent">{fmt(stats.ingresosMes)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ganancias del mes</div>
          <div className="stat-val" style={{ color: stats.gananciasMes >= 0 ? 'var(--teal)' : 'var(--red)' }}>{fmt(stats.gananciasMes)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Margen promedio</div>
          <div className="stat-val">{stats.margenMes}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cotizaciones este mes</div>
          <div className="stat-val">{stats.cotizacionesMes}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><h2>Estado de producción</h2></div>
          <div className="card-body">
            {[
              { label: 'Pendientes / Confirmados', val: stats.pendientes, color: 'var(--amber)' },
              { label: 'En producción', val: stats.enProduccion, color: 'var(--purple)' },
              { label: 'Listos para entregar', val: stats.listos, color: 'var(--teal)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{s.label}</span>
                <span style={{ fontSize: 20, fontWeight: 500, color: s.color }}>{s.val}</span>
              </div>
            ))}
            <button className="btn btn-full" style={{ marginTop: 12 }} onClick={() => navigate('/pedidos')}>Ver todos los pedidos</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Resumen general</h2></div>
          <div className="card-body">
            {[
              { label: 'Piezas en biblioteca', val: stats.totalPiezas },
              { label: 'Clientes registrados', val: stats.totalClientes },
              { label: 'Costos del mes', val: fmt(stats.costosMes) },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{s.label}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{s.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => navigate('/biblioteca')}>Biblioteca</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/cotizador')}>+ Cotizar</button>
            </div>
          </div>
        </div>
      </div>

      {pedidosRecientes.length > 0 && (
        <div className="card">
          <div className="card-header"><h2>Pedidos recientes</h2><button className="btn btn-sm" onClick={() => navigate('/pedidos')}>Ver todos</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead>
              <tbody>
                {pedidosRecientes.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/pedidos')}>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                    <td style={{ fontWeight: 500 }}>{p.clientes?.nombre || 'Sin cliente'}</td>
                    <td><span className={`badge badge-${ESTADO_BADGE[p.estado]}`}>{ESTADO_LABELS[p.estado]}</span></td>
                    <td style={{ fontWeight: 500, color: 'var(--purple)' }}>{fmt(p.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
