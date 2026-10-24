// State Management (Simple and clean for 2nd Year Minor Project)
const state = {
  token: localStorage.getItem("hospital_token"),
  user: null,
  doctors: [],
  selectedSpecialty: "All",
  selectedDoctor: null,
  selectedSlot: null,
  currentRating: 5,
  feedbackApptId: null
};

// Simple Avatar Images for Doctors
const DOCTOR_IMAGES = {
  "Dr. Priya Sharma": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80",
  "Dr. Arjun Mehta": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80",
  "Dr. Sneha Reddy": "https://images.unsplash.com/photo-1594824813583-0597d268d009?auto=format&fit=crop&w=200&q=80",
  "Dr. Vikram Malhotra": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=200&q=80",
  "Dr. Ananya Iyer": "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=200&q=80",
  "Dr. Rajesh Kumar": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=200&q=80"
};

// API Helper (Using standard fetch)
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) {
    headers["Authorization"] = "Bearer " + state.token;
  }

  const res = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Something went wrong. Please try again.");
  }
  return data;
}

// Toast Alert
function toast(msg, bad = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = "toast"), 3000);
}

// Carousel Logic
let currentSlide = 0;
window.setSlide = function(index) {
  document.querySelectorAll(".carousel-slide").forEach((s, i) => s.classList.toggle("active", i === index));
  document.querySelectorAll(".carousel-dots .dot").forEach((d, i) => d.classList.toggle("active", i === index));
  currentSlide = index;
};
setInterval(() => {
  setSlide((currentSlide + 1) % 3);
}, 4000);

// Helper for today's ISO date (YYYY-MM-DD)
function getTodayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// ---------------- AUTHENTICATION ----------------

window.openAuthModal = function(mode = 'login') {
  document.getElementById("authModal").classList.remove("hidden");
  switchAuthTab(mode);
};

window.closeAuthModal = function() {
  document.getElementById("authModal").classList.add("hidden");
};

window.switchAuthTab = function(mode) {
  document.getElementById("tabLogin").classList.toggle("active", mode === "login");
  document.getElementById("tabRegister").classList.toggle("active", mode === "register");
  document.getElementById("nameGroup").classList.toggle("hidden", mode === "login");
  document.getElementById("authModalTitle").textContent = mode === "login" ? "Sign In" : "Patient Registration";
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "Log In" : "Create Account";
  document.getElementById("authError").textContent = "";
};

window.fillLogin = function(email, password) {
  openAuthModal('login');
  document.getElementById("authEmail").value = email;
  document.getElementById("authPassword").value = password;
  document.getElementById("authForm").dispatchEvent(new Event("submit"));
};

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("authError");
  errorEl.textContent = "";

  const isRegister = !document.getElementById("nameGroup").classList.contains("hidden");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  const body = { email, password };
  if (isRegister) {
    body.name = document.getElementById("authName").value.trim();
  }

  try {
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const data = await api(endpoint, { method: "POST", body });

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("hospital_token", data.token);

    closeAuthModal();
    updateUserUI();
    toast(`Welcome, ${data.user.name}!`);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  state.token = null;
  state.user = null;
  localStorage.removeItem("hospital_token");
  updateUserUI();
  toast("Logged out successfully.");
});

function updateUserUI() {
  const guestNav = document.getElementById("guestNav");
  const userNav = document.getElementById("userNav");
  const myApptsNav = document.getElementById("myApptsNav");
  const doctorNav = document.getElementById("doctorNav");
  const myApptsSection = document.getElementById("myApptsSection");
  const doctorDashboardSection = document.getElementById("doctorDashboardSection");

  if (state.user) {
    guestNav.classList.add("hidden");
    userNav.classList.remove("hidden");
    document.getElementById("navUserName").textContent = state.user.name;

    const roleBadge = document.getElementById("navUserRole");
    roleBadge.textContent = state.user.role.toUpperCase();
    roleBadge.className = `badge badge-${state.user.role}`;

    if (state.user.role === "doctor") {
      doctorNav.classList.remove("hidden");
      doctorDashboardSection.classList.remove("hidden");
      myApptsNav.classList.add("hidden");
      myApptsSection.classList.add("hidden");
      loadDoctorAppointments();
    } else {
      myApptsNav.classList.remove("hidden");
      myApptsSection.classList.remove("hidden");
      doctorNav.classList.add("hidden");
      doctorDashboardSection.classList.add("hidden");
      loadMyAppointments();
    }
  } else {
    guestNav.classList.remove("hidden");
    userNav.classList.add("hidden");
    myApptsNav.classList.add("hidden");
    doctorNav.classList.add("hidden");
    myApptsSection.classList.add("hidden");
    doctorDashboardSection.classList.add("hidden");
  }
}

// ---------------- DOCTORS DIRECTORY ----------------

async function loadDoctors() {
  try {
    state.doctors = await api("/api/doctors");
    filterDoctors();
  } catch (err) {
    console.error("Error loading doctors:", err);
  }
}

window.filterSpecialty = function(spec) {
  state.selectedSpecialty = spec;
  document.querySelectorAll(".specialty-pills .pill").forEach(btn => {
    btn.classList.toggle("active", btn.textContent.includes(spec) || (spec === "All" && btn.textContent === "All Doctors"));
  });
  filterDoctors();
};

window.filterDoctors = function() {
  const query = (document.getElementById("searchInput").value || "").toLowerCase();
  const list = state.doctors.filter(d => {
    const matchesSpec = state.selectedSpecialty === "All" || d.specialty === state.selectedSpecialty;
    const matchesSearch = !query || d.name.toLowerCase().includes(query) || d.specialty.toLowerCase().includes(query);
    return matchesSpec && matchesSearch;
  });

  const grid = document.getElementById("doctorsGrid");
  if (!list.length) {
    grid.innerHTML = "<p style='color:#666; grid-column: 1/-1; text-align:center;'>No doctors found matching criteria.</p>";
    return;
  }

  grid.innerHTML = list.map(d => {
    const img = DOCTOR_IMAGES[d.name] || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=0284c7&color=fff&bold=true`;
    return `
      <div class="doctor-card">
        <div class="doctor-header">
          <img src="${img}" alt="${d.name}" class="doctor-avatar">
          <div class="doctor-title">
            <h3>${d.name}</h3>
            <span class="doctor-spec">${d.specialty}</span>
          </div>
        </div>
        <div class="doctor-body">
          <b>Qualification:</b> ${d.qualification}<br>
          <b>Experience:</b> ${d.experience} Years<br>
          <b>Hospital:</b> ${d.hospital}<br>
          <b>Timings:</b> ${d.timings_start} - ${d.timings_end}
        </div>
        <div class="doctor-footer">
          <div class="doctor-fee">
            ₹${d.fee}
            <small>Consultation Fee</small>
          </div>
          <button class="btn btn-primary" onclick="openBooking(${d.id})">Book Slot</button>
        </div>
      </div>
    `;
  }).join("");
};

// ---------------- BOOKING SLOTS ----------------

window.openBooking = function(docId) {
  if (!state.user) {
    openAuthModal('login');
    toast("Please sign in to book an appointment.");
    return;
  }

  const doc = state.doctors.find(d => d.id === docId);
  if (!doc) return;

  state.selectedDoctor = doc;
  state.selectedSlot = null;

  document.getElementById("bookDoctorName").textContent = `Book Visit with ${doc.name}`;
  document.getElementById("bookDoctorMeta").textContent = `${doc.specialty} · Fee: ₹${doc.fee} · ${doc.hospital}`;
  
  const dateInput = document.getElementById("bookDateInput");
  dateInput.min = getTodayIso();
  dateInput.value = getTodayIso();

  document.getElementById("bookingModal").classList.remove("hidden");
  loadDoctorSlots();
};

window.closeBookingModal = function() {
  document.getElementById("bookingModal").classList.add("hidden");
  state.selectedDoctor = null;
  state.selectedSlot = null;
};

window.loadDoctorSlots = async function() {
  if (!state.selectedDoctor) return;
  const date = document.getElementById("bookDateInput").value;
  const container = document.getElementById("slotsContainer");
  const confirmBtn = document.getElementById("confirmBookBtn");
  
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Please choose a time slot";

  try {
    const data = await api(`/api/doctors/${state.selectedDoctor.id}/slots?date=${date}`);
    container.innerHTML = data.slots.map(s => `
      <button class="slot-btn" data-time="${s.time}" ${s.available ? "" : "disabled title='Booked'"}>
        ${s.time}
      </button>
    `).join("");

    container.querySelectorAll(".slot-btn:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.selectedSlot = btn.dataset.time;
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm Booking for ${btn.dataset.time}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444; font-size:0.85rem;">${err.message}</p>`;
  }
};

window.confirmBooking = async function() {
  if (!state.selectedDoctor || !state.selectedSlot) return;

  const body = {
    doctor_id: state.selectedDoctor.id,
    date: document.getElementById("bookDateInput").value,
    time: state.selectedSlot,
    reason: document.getElementById("bookReasonInput").value.trim()
  };

  const confirmBtn = document.getElementById("confirmBookBtn");
  try {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing...";

    const res = await api("/api/appointments", { method: "POST", body });
    closeBookingModal();

    // Show Ticket Modal
    document.getElementById("tkNumber").textContent = res.token_number;
    document.getElementById("tkDocName").textContent = res.doctor.name;
    document.getElementById("tkSpecialty").textContent = res.doctor.specialty;
    document.getElementById("tkTime").textContent = `📅 ${res.date} at ⏰ ${res.time}`;
    document.getElementById("tkFee").textContent = `Consultation Fee: ₹${res.doctor.fee} (Pay at clinic desk)`;
    document.getElementById("ticketModal").classList.remove("hidden");

    loadMyAppointments();
    toast("Appointment booked successfully!");
  } catch (err) {
    document.getElementById("bookingError").textContent = err.message;
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Confirm Booking for ${state.selectedSlot}`;
  }
};

window.closeTicketModal = function() {
  document.getElementById("ticketModal").classList.add("hidden");
};

// ---------------- MY APPOINTMENTS (PATIENT) ----------------

async function loadMyAppointments() {
  const container = document.getElementById("myApptsList");
  try {
    const list = await api("/api/appointments");
    if (!list.length) {
      container.innerHTML = "<p style='color:#666; text-align:center;'>You have no booked appointments yet.</p>";
      return;
    }

    container.innerHTML = list.map(a => `
      <div class="appt-card">
        <div>
          <b style="font-size:1.05rem;">${a.doctor_name}</b> 
          <span class="badge badge-${a.status}">${a.status}</span><br>
          <small style="color:#64748b;">
            🩺 Specialty: <b>${a.specialty}</b> | 🏥 ${a.hospital}<br>
            📅 Date: <b>${a.date}</b> | ⏰ Time: <b>${a.time}</b> | Token: <b style="color:#0284c7;">${a.token_number}</b>
            ${a.reason ? `<br>💬 Reason: "${a.reason}"` : ""}
            ${a.rating ? `<br>⭐ Your Rating: ${a.rating}/5 ("${a.review}")` : ""}
          </small>
        </div>
        <div style="display:flex; gap:0.5rem;">
          ${a.status !== 'cancelled' ? `<button class="btn btn-outline-dark btn-sm" onclick="cancelAppointment(${a.id})">Cancel</button>` : ''}
          ${a.status === 'confirmed' && !a.rating ? `<button class="btn btn-primary btn-sm" onclick="openFeedback(${a.id})">Feedback</button>` : ''}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;">${err.message}</p>`;
  }
}

window.cancelAppointment = async function(id) {
  if (!confirm("Are you sure you want to cancel this appointment?")) return;
  try {
    await api(`/api/appointments/${id}`, { method: "DELETE" });
    toast("Appointment cancelled.");
    loadMyAppointments();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------------- DOCTOR DASHBOARD ----------------

async function loadDoctorAppointments() {
  const container = document.getElementById("doctorApptsList");
  try {
    const list = await api("/api/appointments");
    if (!list.length) {
      container.innerHTML = "<p style='color:#666; text-align:center;'>No patient appointments scheduled yet.</p>";
      return;
    }

    container.innerHTML = list.map(a => `
      <div class="appt-card">
        <div>
          <b style="font-size:1.05rem;">Patient: ${a.patient_name || 'Patient'}</b> (${a.patient_email || ''})<br>
          <small style="color:#64748b;">
            📅 Date: <b>${a.date}</b> | ⏰ Time: <b>${a.time}</b> | Token: <b style="color:#0284c7;">${a.token_number}</b><br>
            ${a.reason ? `Reason: "${a.reason}"<br>` : ""}
            Status: <span class="badge badge-${a.status}">${a.status.toUpperCase()}</span>
            ${a.rating ? `<br>Patient Feedback: ${'★'.repeat(a.rating)} ("${a.review}")` : ""}
          </small>
        </div>
        <div style="display:flex; gap:0.5rem;">
          ${a.status === 'confirmed' ? `
            <button class="btn btn-success btn-sm" onclick="updateApptStatus(${a.id}, 'completed')">Mark Completed</button>
            <button class="btn btn-danger btn-sm" onclick="updateApptStatus(${a.id}, 'cancelled')">Decline</button>
          ` : ''}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;">${err.message}</p>`;
  }
}

window.updateApptStatus = async function(id, status) {
  try {
    await api(`/api/appointments/${id}/status`, { method: "PATCH", body: { status } });
    toast(`Appointment updated to ${status}.`);
    loadDoctorAppointments();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------------- FEEDBACK (STARS & REVIEW) ----------------

window.openFeedback = function(apptId) {
  state.feedbackApptId = apptId;
  setRating(5);
  document.getElementById("feedbackReview").value = "";
  document.getElementById("feedbackModal").classList.remove("hidden");
};

window.closeFeedbackModal = function() {
  document.getElementById("feedbackModal").classList.add("hidden");
  state.feedbackApptId = null;
};

window.setRating = function(stars) {
  state.currentRating = stars;
  const starEls = document.querySelectorAll(".star-rating .star");
  starEls.forEach((el, idx) => {
    el.classList.toggle("active", idx < stars);
  });
};

window.submitFeedback = async function() {
  if (!state.feedbackApptId) return;
  const review = document.getElementById("feedbackReview").value.trim();

  try {
    await api(`/api/appointments/${state.feedbackApptId}/feedback`, {
      method: "POST",
      body: { rating: state.currentRating, review }
    });
    closeFeedbackModal();
    toast("Thank you for your feedback!");
    loadMyAppointments();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------------- INITIALIZATION ----------------

window.addEventListener("DOMContentLoaded", async () => {
  loadDoctors();

  // If token exists, fetch user profile
  if (state.token) {
    try {
      state.user = await api("/api/auth/me");
      updateUserUI();
    } catch (e) {
      state.token = null;
      localStorage.removeItem("hospital_token");
      updateUserUI();
    }
  }
});
