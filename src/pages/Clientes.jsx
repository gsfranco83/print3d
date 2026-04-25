import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', notas: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchClientes() }, [])

  async function fetchClientes() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select('*, piezas(count), pedidos(count)')
      .order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setSaving(true)
    await supabase.from('clientes').insert(form)
    setForm({ nombre: '', email: '', telefono: '', notas: '' })
    setShowForm(false)
    fetchClientes()
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Clientes</h1><p>{clientes.length} clientes registrados</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>+ Nuevo cliente</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header"><h2>Nuevo cliente</h2></div>
          <div className="card-body">
            <div className="fields-2">
              <div className="field"><label>Nombre *</label><input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre o empresa" autoFocus /></div>
              <div className="field"><label>Teléfono / Instagram</label><input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="@usuario o número" /></div>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="field"><label>Notas</label><textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Cómo llegó, preferencias, etc." /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={guardar} disabled={saving || !form.nombre.trim()}>{saving ? 'Guardando...' : 'Guardar cliente'}</button>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="empty-state"><p>Cargando...</p></div> :
        clientes.length === 0 ? <div className="empty-state"><p>No hay clientes todavía.</p></div> :
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Contacto</th><th>Piezas</th><th>Pedidos</th><th>Notas</th></tr></thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {c.telefono && <div>{c.telefono}</div>}
                      {c.email && <div>{c.email}</div>}
                    </td>
                    <td>{c.piezas?.[0]?.count || 0}</td>
                    <td>{c.pedidos?.[0]?.count || 0}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  )
}
