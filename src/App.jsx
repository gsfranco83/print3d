import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Cotizador from './pages/Cotizador'
import Biblioteca from './pages/Biblioteca'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import Dashboard from './pages/Dashboard'
import Configuracion from './pages/Configuracion'
import Login from './pages/Login'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { to: '/cotizador', label: 'Cotizador', icon: <IconCotizador /> },
  { to: '/biblioteca', label: 'Biblioteca', icon: <IconBiblioteca /> },
  { to: '/pedidos', label: 'Pedidos', icon: <IconPedidos /> },
  { to: '/clientes', label: 'Clientes', icon: <IconClientes /> },
]

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div style={{ padding: '2rem', color: '#888' }}>Cargando...</div>
  if (!session) return <Login />

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Print3D</h1>
          <p>Gestión de impresión</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
          <div style={{ height: '0.5px', background: 'var(--border)', margin: '8px 1rem' }} />
          <NavLink to="/configuracion" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <IconConfig />
            Configuración
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <div style={{ marginBottom: 4 }}>{session.user.email}</div>
          <button className="btn btn-sm" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cotizador" element={<Cotizador />} />
          <Route path="/cotizador/:piezaId" element={<Cotizador />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Routes>
      </main>
    </div>
  )
}

function IconDashboard() {
  return <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
}
function IconCotizador() {
  return <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M8 2L2 5v6l6 3 6-3V5L8 2z"/><path d="M8 2v9M2 5l6 3 6-3"/></svg>
}
function IconBiblioteca() {
  return <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="3" width="14" height="10" rx="1"/><path d="M5 3V1M11 3V1M1 7h14"/></svg>
}
function IconPedidos() {
  return <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 2h12l-1.5 9H3.5L2 2z"/><path d="M5 2L4 6h8l-1-4"/><circle cx="5.5" cy="13.5" r="1"/><circle cx="10.5" cy="13.5" r="1"/></svg>
}
function IconClientes() {
  return <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"/></svg>
}
function IconConfig() {
  return <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
}
