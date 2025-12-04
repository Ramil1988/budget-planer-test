/* =====================
1. Mobile MenuToggle hamburger menu open/closed
2. Form SubmissionHandle signup, validate, save data
3. Helper FunctionsEmail validation, show messages, save to localStorage
4. Active Nav LinkAuto-highlight current page in navigation
5. Feature CardsStaggered fade-in animation6. Scroll to TopCreate button that appears when you scroll down

   Wait for DOM to be ready
   Why? JavaScript runs immediately, but HTML might not be fully loaded yet.
   This event fires when all HTML is parsed and ready to manipulate.
   ===================== */
document.addEventListener("DOMContentLoaded", function () {
  /* =====================
       1. MOBILE MENU TOGGLE
       Hamburger menu for mobile screens
       ===================== */

  const navToggle = document.querySelector(".nav-toggle"); // Select hamburger button
  const navList = document.querySelector(".nav-list"); // Select navigation list

  if (navToggle) {
    // Check if element exists (safety)
    navToggle.addEventListener("click", function () {
      // Listen for click on hamburger
      navList.classList.toggle("open"); // Add/remove "open" class

      const isOpen = navList.classList.contains("open"); // Check if menu is now open
      navToggle.textContent = isOpen ? "✕" : "☰"; // Change icon based on state
    });
  }

  /* =====================
       2. FORM SUBMISSION
       Handle newsletter signup form
       ===================== */

  const signupForm = document.getElementById("signup-form"); // Select form by ID
  const formMessage = document.getElementById("form-message"); // Select message display area

  if (signupForm) {
    // Check if form exists on this page
    signupForm.addEventListener("submit", function (event) {
      // Listen for form submission
      event.preventDefault(); // CRITICAL: Stop page from refreshing

      const name = document.getElementById("name").value; // Get name input value
      const email = document.getElementById("email").value; // Get email input value

      /* --- Validation --- */
      if (name.length < 2) {
        // Check name length
        showMessage("Name must be at least 2 characters", "error"); // Show error
        return; // Stop execution here
      }

      if (!isValidEmail(email)) {
        // Check email format
        showMessage("Please enter a valid email", "error"); // Show error
        return; // Stop execution here
      }

      /* --- Save Data --- */
      const subscriber = {
        // Create subscriber object
        name: name, // Store name
        email: email, // Store email
        date: new Date().toISOString(), // Store current date/time
      };
      saveSubscriber(subscriber); // Save to localStorage

      /* --- Success --- */
      showMessage(`Thanks ${name}! You're subscribed.`, "success"); // Show success message
      signupForm.reset(); // Clear all form inputs
    });
  }

  /* =====================
       3. HELPER FUNCTIONS
       Reusable functions used above
       ===================== */

  /**
   * Validate email format using regex
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid, false if not
   */
  function isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex pattern for email
    return pattern.test(email); // Returns true/false
  }

  /**
   * Display message to user
   * @param {string} text - Message to display
   * @param {string} type - "success" or "error" for styling
   */
  function showMessage(text, type) {
    formMessage.textContent = text; // Set message text
    formMessage.className = "form-message " + type; // Set class for styling

    setTimeout(function () {
      // Set a timer
      formMessage.textContent = ""; // Clear message text
      formMessage.className = "form-message"; // Reset class
    }, 5000); // After 5000ms (5 seconds)
  }

  /**
   * Save subscriber to browser's localStorage
   * @param {object} subscriber - Object with name, email, date
   */
  function saveSubscriber(subscriber) {
    const existing = localStorage.getItem("subscribers"); // Get existing data (string or null)

    let subscribers; // Declare array variable
    if (existing) {
      // If data exists
      subscribers = JSON.parse(existing); // Convert string to array
    } else {
      // If no data yet
      subscribers = []; // Start with empty array
    }

    subscribers.push(subscriber); // Add new subscriber to array

    const dataString = JSON.stringify(subscribers); // Convert array to string
    localStorage.setItem("subscribers", dataString); // Save to localStorage

    console.log("Saved subscribers:", subscribers); // Log for debugging
  }

  /* =====================
       4. ACTIVE NAV LINK HIGHLIGHT
       Automatically highlight current page in navigation
       ===================== */

  const navLinks = document.querySelectorAll(".nav-link"); // Select all nav links

  const fullPath = window.location.pathname; // Get current URL path (e.g., "/pages/features.html")
  const pathParts = fullPath.split("/"); // Split by "/" into array
  const currentPage = pathParts.pop() || "index.html"; // Get last part (filename) or default to index.html

  navLinks.forEach(function (link) {
    // Loop through each nav link
    const href = link.getAttribute("href"); // Get link's href attribute
    const linkPage = href.split("#")[0]; // Remove anchor part (e.g., "index.html#feautures" → "index.html")

    if (linkPage === currentPage) {
      // If link matches current page
      link.classList.add("active"); // Add active class
    } else {
      // If link doesn't match
      link.classList.remove("active"); // Remove active class (in case it was set in HTML)
    }
  });

  /* =====================
       5. FEATURE CARDS ANIMATION
       Staggered fade-in effect for cards
       ===================== */

  const featureCards = document.querySelectorAll(".feature-card"); // Select all feature cards

  featureCards.forEach(function (card, index) {
    // Loop with index (0, 1, 2...)
    const delay = index * 0.1; // Calculate delay: 0s, 0.1s, 0.2s...
    card.style.animationDelay = delay + "s"; // Set CSS animation-delay
    card.classList.add("fade-in"); // Add class that triggers animation
  });

  /* =====================
       6. SCROLL TO TOP BUTTON
       Dynamically created button that appears on scroll
       ===================== */

  /* --- Create the button element --- */
  const scrollBtn = document.createElement("button"); // Create new <button> element
  scrollBtn.className = "scroll-top-btn"; // Set CSS class
  scrollBtn.textContent = "↑"; // Set button text (arrow)
  scrollBtn.setAttribute("aria-label", "Scroll to top"); // Accessibility label
  document.body.appendChild(scrollBtn); // Add button to page

  /* --- Show/hide based on scroll position --- */
  window.addEventListener("scroll", function () {
    // Listen for scroll event
    const scrollPosition = window.scrollY; // Get pixels scrolled from top

    if (scrollPosition > 300) {
      // If scrolled more than 300px
      scrollBtn.classList.add("visible"); // Show button
    } else {
      // If near top
      scrollBtn.classList.remove("visible"); // Hide button
    }
  });

  /* --- Scroll to top when clicked --- */
  scrollBtn.addEventListener("click", function () {
    // Listen for click on button
    window.scrollTo({
      // Scroll the window
      top: 0, // To top of page
      behavior: "smooth", // With smooth animation
    });
  });
}); // End of DOMContentLoaded
