import os
import sqlite3
from typing import Generator
from auth import hash_password

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hospital.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    # 1. Users table (Patients, Doctors, Admins)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'patient', -- 'patient', 'doctor', 'admin'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Doctors table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        qualification TEXT NOT NULL,
        experience INTEGER NOT NULL,
        fee INTEGER NOT NULL,
        timings_start TEXT DEFAULT '09:00',
        timings_end TEXT DEFAULT '17:00',
        hospital TEXT DEFAULT 'City Multispecialty Hospital',
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    );
    """)

    # 3. Appointments table (matching healthcare-appointment-scheduling-app)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        reason TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'completed'
        token_number TEXT NOT NULL,
        rating INTEGER DEFAULT 0,
        review TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE
    );
    """)

    # Seed Admin User
    cur.execute("SELECT id FROM users WHERE email = 'admin@hospital.com'")
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Hospital Admin", "admin@hospital.com", hash_password("admin123"), "admin")
        )

    # Seed Doctors
    cur.execute("SELECT COUNT(*) as count FROM doctors")
    if cur.fetchone()["count"] == 0:
        sample_doctors = [
            ("Dr. Priya Sharma", "General Physician", "MBBS, MD", 10, 500, "09:00", "17:00", "City Multispecialty Hospital", "priya@hospital.com"),
            ("Dr. Arjun Mehta", "Cardiologist", "MBBS, MD (Cardiology)", 14, 1000, "10:00", "16:00", "Heart Care Center", "arjun@hospital.com"),
            ("Dr. Sneha Reddy", "Dermatologist", "MBBS, DVD (Dermatology)", 8, 700, "11:00", "18:00", "Skin & Glow Clinic", "sneha@hospital.com"),
            ("Dr. Vikram Malhotra", "Orthopedic", "MBBS, MS (Orthopedics)", 12, 850, "09:30", "15:30", "Bone & Joint Center", "vikram@hospital.com"),
            ("Dr. Ananya Iyer", "Pediatrician", "MBBS, DCH (Child Care)", 9, 600, "10:00", "17:00", "Children Hospital", "ananya@hospital.com"),
            ("Dr. Rajesh Kumar", "Neurologist", "MBBS, DM (Neurology)", 15, 1200, "12:00", "18:00", "Neuro Care Clinic", "rajesh@hospital.com"),
        ]

        for doc in sample_doctors:
            name, specialty, qual, exp, fee, t_start, t_end, hosp, email = doc
            cur.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'doctor')",
                (name, email, hash_password("doctor123"))
            )
            uid = cur.lastrowid
            cur.execute(
                """INSERT INTO doctors (user_id, name, specialty, qualification, experience, fee, timings_start, timings_end, hospital)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (uid, name, specialty, qual, exp, fee, t_start, t_end, hosp)
            )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
