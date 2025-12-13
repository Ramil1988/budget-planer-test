import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <span className="logo-icon">💰</span>
          <span className="logo-text">BudgetWise</span>
        </div>
        <nav className="nav">
          <ul className={`nav-list ${isMenuOpen ? 'open' : ''}`}>
            <li>
              <Link
                to="/"
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/features"
                className={`nav-link ${isActive('/features') ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
            </li>
          </ul>
        </nav>
        <button
          className="nav-toggle"
          aria-label="Toggle navigation"
          onClick={toggleMenu}
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  )
}

export default Header
