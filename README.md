# 🏥 Hospital Appointment Scheduling System
**B.Tech 2nd Year Minor Project**

A clean, responsive Hospital Appointment Scheduling Web Application inspired by the [Project-Based-Learning-IT Healthcare Scheduling App](https://github.com/Project-Based-Learning-IT/healthcare-appointment-scheduling-app/tree/calendar), built with simple, solid fundamentals: **HTML5**, **CSS3**, **Vanilla JavaScript**, **Python (FastAPI)**, and **SQLite3**.

---

## 🌟 Key Features

1. **Patient Portal**:
   - Register and log in.
   - Filter doctors by specialty (*General Physician, Cardiologist, Dermatologist, Orthopedic, Pediatrician, Neurologist*).
   - Select date and pick an available 30-minute time slot.
   - Server-side double booking prevention.
   - Instant digital appointment token pass (`MED-XX123`).
   - View scheduled appointments with cancel option.
   - Leave post-visit doctor feedback (1–5 star rating and review).

2. **Doctor Portal**:
   - Dedicated doctor login.
   - View patient queue with visit reasons and dates/times.
   - Mark visits as completed or decline appointments.

3. **Modern, Responsive Frontend**:
   - Top navigation bar.
   - Hero banner with 3-slide visual carousel.
   - Patient & Doctor access cards.
   - Search box and specialty filter pills.
   - Clean modal dialogs for booking, token pass, and feedback.

---

## 🚀 How to Run the Project

### Prerequisites
- Python 3.10+ (Python 3.12 is already configured)

### Quick Start
Double-click `run.bat` or run the following command in terminal:
```bash
python -m uvicorn main:app --reload --port 8000
```

Then open your browser at:
👉 **`http://127.0.0.1:8000`**

---

## 🔑 Pre-Configured Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Doctor** | `priya@hospital.com` | `doctor123` |
| **Admin** | `admin@hospital.com` | `admin123` |
| **Patient** | Register any new account or click "Sign Up" | *Min 6 chars* |

*(Quick-click demo buttons are available directly on the login modal!)*

---

## 📂 Project Structure

```
mediassist/
├── main.py                         # Clean FastAPI routes (under 250 lines)
├── database.py                     # SQLite schema (users, doctors, appointments)
├── auth.py                         # Password hashing and JWT session tokens
├── static/
│   ├── style.css                   # Clean, responsive CSS styling
│   └── app.js                      # Clear, commented JavaScript logic
├── index.html                      # Single page HTML layout
├── PRESENTATION_AND_VIVA_GUIDE.md  # 7-day study plan, 10 PPT slides & Top 10 Viva Q&A
├── requirements.txt                # Python dependencies
├── run.bat                         # 1-click startup script
└── verify.py                       # Automated verification test script
```
