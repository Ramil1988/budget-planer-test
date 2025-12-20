import { useEffect } from 'react'

function Features() {
  useEffect(() => {
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
        {/* Page Hero */}
        <section className="page-hero">
          <h1>
            Powerful Features for <span className="highlight">Smart Budgeting</span>
          </h1>
          <p>
            Everything you need to take control of your finances in one simple app.
          </p>
        </section>

        {/* Detailed Features Section */}
        <section className="features-detailed">
          <div className="feature-row">
            <div className="feature-text">
              <h2>📊 Visual Reports & Analytics</h2>
              <p>
                Understand your spending habits with beautiful, easy-to-read charts.
                See exactly where your money goes each month with breakdowns by
                category.
              </p>
              <ul className="feature-list">
                <li>Monthly spending pie charts</li>
                <li>Income vs expenses comparison</li>
                <li>Trend analysis over time</li>
              </ul>
            </div>
            <div className="feature-image">
              <img
                src="/images/visual.jpg"
                alt="Visual reports dashboard"
              />
            </div>
          </div>

          <div className="feature-row reverse">
            <div className="feature-text">
              <h2>🎯 Goal Tracking</h2>
              <p>
                Set savings goals and watch your progress in real-time. Whether it's
                a vacation, emergency fund, or new car - we help you get there.
              </p>
              <ul className="feature-list">
                <li>Create unlimited savings goals</li>
                <li>Visual progress bars</li>
                <li>Milestone celebrations</li>
              </ul>
            </div>
            <div className="feature-image">
              <img src="/images/goal-tracking.png" alt="Goal tracking interface" />
            </div>
          </div>

          <div className="feature-row">
            <div className="feature-text">
              <h2>🔔 Smart Alerts & Notifications</h2>
              <p>
                Never overspend again. Get notified when you're approaching budget
                limits or when unusual spending is detected.
              </p>
              <ul className="feature-list">
                <li>Budget limit warnings</li>
                <li>Bill payment reminders</li>
                <li>Weekly spending summaries</li>
              </ul>
            </div>
            <div className="feature-image">
              <img src="/images/alerts.png" alt="Smart alerts example" />
            </div>
          </div>

          <div className="feature-row">
            <div className="feature-text">
              <h2>📸 Smart Receipt Scanner</h2>
              <p>
                Simply snap a photo of your receipts or bank statements and let our
                OCR technology do the rest. All expenses are automatically extracted
                and added to your tracking sheet.
              </p>
              <ul className="feature-list">
                <li>Instant receipt scanning via camera or screenshot</li>
                <li>Automatic expense categorization</li>
                <li>Bulk import from bank statement images</li>
              </ul>
            </div>
            <div className="feature-image">
              <img src="/images/OCR.jpg" alt="OCR receipt scanner feature" />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <h2>Ready to Take Control?</h2>
          <p>
            Start tracking your budget and build better financial habits today.
          </p>
          <div className="cta-buttons">
            <button className="btn btn-primary">Launch Tool</button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default Features
