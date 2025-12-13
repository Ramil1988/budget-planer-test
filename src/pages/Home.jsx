import { useEffect } from 'react'

function Home() {
  useEffect(() => {
    // Feature cards animation
    const featureCards = document.querySelectorAll('.feature-card')
    featureCards.forEach((card, index) => {
      const delay = index * 0.1
      card.style.animationDelay = `${delay}s`
      card.classList.add('fade-in')
    })

    // Scroll to top button
    const scrollBtn = document.createElement('button')
    scrollBtn.className = 'scroll-top-btn'
    scrollBtn.textContent = '↑'
    scrollBtn.setAttribute('aria-label', 'Scroll to top')
    document.body.appendChild(scrollBtn)

    const handleScroll = () => {
      const scrollPosition = window.scrollY
      if (scrollPosition > 300) {
        scrollBtn.classList.add('visible')
      } else {
        scrollBtn.classList.remove('visible')
      }
    }

    const handleScrollTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }

    window.addEventListener('scroll', handleScroll)
    scrollBtn.addEventListener('click', handleScrollTop)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      scrollBtn.removeEventListener('click', handleScrollTop)
      scrollBtn.remove()
    }
  }, [])

  return (
    <main>
      <div className="main-container">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <h1>
              Simple <span className="highlight">Budget Tracking</span> Tool
            </h1>
            <p className="hero-subtitle">
              Track your expenses, set budgets, and monitor your spending with
              this clean and intuitive budget management tool.
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary">Start Tracking</button>
            </div>
          </div>
          <div className="hero-image">
            <img
              src="/images/hero-dashboard.png"
              alt="Budget dashboard preview"
            />
          </div>
        </section>

        {/* Features Preview Section */}
        <section className="features-preview" id="features">
          <h2>Why Choose BudgetWise?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Visual Reports</h3>
              <p>See where your money goes with beautiful charts and graphs.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Goal Tracking</h3>
              <p>Set savings goals and track your progress in real-time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Smart Alerts</h3>
              <p>Get notified when you're approaching your budget limits.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default Home
