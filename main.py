import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import init_db, get_db_connection
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    get_token_from_header
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Initialize database schema and default doctors
init_db()

app = FastAPI(title="Hospital Appointment Booking System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Pydantic Schemas for Validation
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=60)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=100)
    password: str


class BookAppointmentRequest(BaseModel):
    doctor_id: int
    date: str
    time: str
    reason: str = Field("", max_length=250)


class UpdateStatusRequest(BaseModel):
    status: str  # 'confirmed', 'cancelled', 'completed'


class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review: str = Field("", max_length=300)


# Current User Dependency
def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = get_token_from_header(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please log in first")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired, please log in again")

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, email, role FROM users WHERE id = ?", (payload.get("sub"),))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return dict(user)


# ---------------- API ROUTES ----------------

@app.get("/")
def home():
    index_file = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>Hospital Appointment Booking System is running.</h1>")


# 1. AUTHENTICATION
@app.post("/api/auth/register")
def register_patient(data: RegisterRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    email_clean = data.email.lower().strip()

    cur.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    hashed_pw = hash_password(data.password)
    cur.execute(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'patient')",
        (data.name.strip(), email_clean, hashed_pw)
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()

    token = create_access_token({"sub": user_id, "name": data.name, "email": email_clean, "role": "patient"})
    return {"token": token, "user": {"id": user_id, "name": data.name, "email": email_clean, "role": "patient"}}


@app.post("/api/auth/login")
def login(data: LoginRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    email_clean = data.email.lower().strip()

    cur.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = ?", (email_clean,))
    user = cur.fetchone()
    conn.close()

    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]})
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}}


@app.get("/api/auth/me")
def get_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user


# 2. DOCTOR DIRECTORY & SLOTS
@app.get("/api/doctors")
def get_doctors(specialty: Optional[str] = None, q: Optional[str] = None):
    conn = get_db_connection()
    cur = conn.cursor()

    query = "SELECT * FROM doctors WHERE 1=1"
    params = []

    if specialty and specialty != "All":
        query += " AND specialty = ?"
        params.append(specialty)

    if q:
        query += " AND (name LIKE ? OR qualification LIKE ? OR specialty LIKE ?)"
        wildcard = f"%{q.strip()}%"
        params.extend([wildcard, wildcard, wildcard])

    cur.execute(query + " ORDER BY id ASC", params)
    doctors = [dict(r) for r in cur.fetchall()]
    conn.close()
    return doctors


@app.get("/api/doctors/{doctor_id}/slots")
def get_doctor_available_slots(doctor_id: int, date: str):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM doctors WHERE id = ?", (doctor_id,))
    doctor = cur.fetchone()
    if not doctor:
        conn.close()
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Fetch booked times on that date
    cur.execute("""
        SELECT time FROM appointments 
        WHERE doctor_id = ? AND date = ? AND status != 'cancelled'
    """, (doctor_id, date))
    booked_times = {row["time"] for row in cur.fetchall()}
    conn.close()

    # Generate 30-min slots
    t_start = doctor["timings_start"] or "09:00"
    t_end = doctor["timings_end"] or "17:00"

    try:
        sh, sm = map(int, t_start.split(":"))
        eh, em = map(int, t_end.split(":"))
    except Exception:
        sh, sm, eh, em = 9, 0, 17, 0

    slots = []
    curr = datetime(2026, 1, 1, sh, sm)
    end = datetime(2026, 1, 1, eh, em)

    while curr < end:
        time_str = curr.strftime("%H:%M")
        slots.append({
            "time": time_str,
            "available": time_str not in booked_times
        })
        curr += timedelta(minutes=30)

    return {"doctor_id": doctor_id, "date": date, "slots": slots}


# 3. APPOINTMENTS
@app.get("/api/appointments")
def list_appointments(current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()

    if current_user["role"] == "doctor":
        # Find doctor profile
        cur.execute("SELECT id FROM doctors WHERE user_id = ?", (current_user["id"],))
        doc = cur.fetchone()
        if doc:
            cur.execute("""
                SELECT a.*, u.name as patient_name, u.email as patient_email, d.name as doctor_name, d.specialty
                FROM appointments a
                JOIN users u ON a.user_id = u.id
                JOIN doctors d ON a.doctor_id = d.id
                WHERE a.doctor_id = ?
                ORDER BY a.date DESC, a.time DESC
            """, (doc["id"],))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return rows

    # Patient appointments
    cur.execute("""
        SELECT a.*, d.name as doctor_name, d.specialty, d.qualification, d.fee, d.hospital
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.user_id = ?
        ORDER BY a.date DESC, a.time DESC
    """, (current_user["id"],))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@app.post("/api/appointments")
def book_appointment(data: BookAppointmentRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()

    # Verify doctor exists
    cur.execute("SELECT * FROM doctors WHERE id = ?", (data.doctor_id,))
    doctor = cur.fetchone()
    if not doctor:
        conn.close()
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Double booking prevention check
    cur.execute("""
        SELECT id FROM appointments 
        WHERE doctor_id = ? AND date = ? AND time = ? AND status != 'cancelled'
    """, (data.doctor_id, data.date, data.time))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="This time slot is already booked. Please choose another slot.")

    # Generate token number (e.g. MED-742)
    token_number = f"MED-{''.join(random.choices(string.ascii_uppercase, k=2))}{random.randint(100, 999)}"

    cur.execute("""
        INSERT INTO appointments (user_id, doctor_id, date, time, reason, status, token_number)
        VALUES (?, ?, ?, ?, ?, 'confirmed', ?)
    """, (current_user["id"], data.doctor_id, data.date, data.time, data.reason, token_number))
    appt_id = cur.lastrowid
    conn.commit()
    conn.close()

    return {
        "success": True,
        "appointment_id": appt_id,
        "token_number": token_number,
        "doctor": {"name": doctor["name"], "specialty": doctor["specialty"], "fee": doctor["fee"]},
        "date": data.date,
        "time": data.time,
        "status": "confirmed"
    }


@app.delete("/api/appointments/{appt_id}")
def cancel_appointment(appt_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM appointments WHERE id = ?", (appt_id,))
    appt = cur.fetchone()
    if not appt:
        conn.close()
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user["role"] != "admin" and appt["user_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Permission denied")

    cur.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", (appt_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Appointment cancelled successfully"}


@app.patch("/api/appointments/{appt_id}/status")
def update_status(appt_id: int, data: UpdateStatusRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE appointments SET status = ? WHERE id = ?", (data.status, appt_id))
    conn.commit()
    conn.close()
    return {"success": True, "status": data.status}


# Feedback & Review (Matching reference repo)
@app.post("/api/appointments/{appt_id}/feedback")
def submit_feedback(appt_id: int, data: FeedbackRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE appointments SET rating = ?, review = ? WHERE id = ? AND user_id = ?",
                (data.rating, data.review.strip(), appt_id, current_user["id"]))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Feedback submitted successfully!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
