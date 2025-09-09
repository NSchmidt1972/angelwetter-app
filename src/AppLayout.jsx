// src/AppLayout.jsx
import Navbar from './components/Navbar';
import { Outlet } from 'react-router-dom';

export default function AppLayout({ name, isAdmin }) {
  return (
    <>
      <Navbar name={name} isAdmin={isAdmin} />
      <div className="container mx-auto px-3 py-4">
        <Outlet />
      </div>
    </>
  );
}
