const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3107;
const VALID_TOKEN = "mock-jwt-token";

app.use(cors());
app.use(express.json());

// ---------------- Data (in-memory + saved to employees.json) ----------------
const DATA_FILE = path.join(__dirname, "employees.json");

const defaultEmployees = [
  { id: "1", name: "John Doe", position: "Software Engineer", status: "Active", salary: 45000 },
  { id: "2", name: "Jane Smith", position: "UX Designer", status: "Active", salary: 38000 },
  { id: "3", name: "Somchai Jaidee", position: "Intern", status: "On Leave", salary: 15000 },
  { id: "4", name: "Suda Rakdee", position: "HR Officer", status: "Active", salary: 22000 },
  { id: "5", name: "Michael Brown", position: "Engineering Manager", status: "Active", salary: 85000 },
  { id: "6", name: "Anong Srisuk", position: "Senior Engineer", status: "Active", salary: 65000 },
  { id: "7", name: "Peter Lee", position: "Support Staff", status: "On Leave", salary: 18000 },
];

let employees;
try {
  employees = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!Array.isArray(employees)) throw new Error("bad data");
} catch {
  employees = defaultEmployees; // ยังไม่มีไฟล์ หรือไฟล์เสีย → ใช้ข้อมูลตั้งต้น
}
let nextId = Math.max(0, ...employees.map((e) => Number(e.id) || 0)) + 1;

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(employees, null, 2));
  } catch (err) {
    console.error("Failed to save data:", err.message);
  }
}

// ---------------- Auth ----------------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "admin" && password === "password123") {
    return res.status(200).json({ success: true, token: VALID_TOKEN });
  }
  return res.status(401).json({ success: false, message: "Invalid username or password" });
});

// Block unauthorized access to employee APIs
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== VALID_TOKEN) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}
app.use("/api/employees", requireAuth);

// ---------------- K-Means (1D) ----------------
function kMeans1D(values, k = 3, maxIter = 100) {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const unique = [...new Set(sorted)];
  const kk = Math.min(k, unique.length); // ถ้าเงินเดือนต่างกันไม่ถึง 3 ค่า ใช้เท่าที่มี

  // เริ่ม centroid กระจายตาม quantile ของค่าที่ไม่ซ้ำ
  let centroids = [];
  for (let i = 0; i < kk; i++) {
    const idx = Math.round((i * (unique.length - 1)) / Math.max(kk - 1, 1));
    centroids.push(unique[idx]);
  }

  let assignments = new Array(sorted.length).fill(-1);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // Assign แต่ละค่าไปหา centroid ที่ใกล้ที่สุด
    sorted.forEach((v, i) => {
      let best = 0;
      for (let c = 1; c < centroids.length; c++) {
        if (Math.abs(v - centroids[c]) < Math.abs(v - centroids[best])) best = c;
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    });

    // Update centroid = ค่าเฉลี่ยของกลุ่ม (กลุ่มว่างคงค่าเดิม กันหารด้วย 0)
    centroids = centroids.map((old, c) => {
      const members = sorted.filter((_, i) => assignments[i] === c);
      return members.length ? members.reduce((s, x) => s + x, 0) / members.length : old;
    });

    if (!changed) break;
  }

  return centroids
    .map((centroid, c) => ({
      centroid,
      count: assignments.filter((a) => a === c).length,
    }))
    .filter((cl) => cl.count > 0)
    .sort((a, b) => a.centroid - b.centroid)
    .map((cl, i) => ({
      group: `Tier ${i + 1}`,
      centroid: Math.round(cl.centroid),
      count: cl.count,
    }));
}

// ต้องอยู่ก่อน route ที่มี :id
app.get("/api/employees/salary-clusters", (req, res) => {
  try {
    const salaries = employees
      .map((e) => Number(e.salary))
      .filter((s) => Number.isFinite(s));
    const clusters = kMeans1D(salaries, 3);
    return res.status(200).json({ success: true, clusters });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Clustering failed" });
  }
});

// ---------------- CRUD ----------------
// GET /api/employees            → ทั้งหมด
// GET /api/employees?search=john → ค้นหาจาก name / position / status (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
app.get("/api/employees", (req, res) => {
  const q = String(req.query.search || "").trim().toLowerCase();
  if (!q) return res.status(200).json(employees);

  const result = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q)
  );
  return res.status(200).json(result);
});

app.post("/api/employees", (req, res) => {
  const { name, position, salary } = req.body || {};
  const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";

  if (isEmpty(name) || isEmpty(position) || isEmpty(salary)) {
    return res.status(400).json({ success: false, message: "name, position and salary are required" });
  }
  const salaryNum = Number(salary);
  if (!Number.isFinite(salaryNum) || salaryNum < 0) {
    return res.status(400).json({ success: false, message: "salary must be a non-negative number" });
  }

  const newEmployee = {
    id: String(nextId++),
    name: String(name).trim(),
    position: String(position).trim(),
    status: "Active",
    salary: salaryNum,
  };
  employees.push(newEmployee);
  saveData();
  return res.status(201).json(newEmployee);
});

// แก้ไขข้อมูลพนักงาน (name, position, salary)
app.put("/api/employees/:id", (req, res) => {
  const emp = employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ success: false, message: "Employee not found" });

  const { name, position, salary } = req.body || {};
  const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";
  if (isEmpty(name) || isEmpty(position) || isEmpty(salary)) {
    return res.status(400).json({ success: false, message: "name, position and salary are required" });
  }
  const salaryNum = Number(salary);
  if (!Number.isFinite(salaryNum) || salaryNum < 0) {
    return res.status(400).json({ success: false, message: "salary must be a non-negative number" });
  }

  emp.name = String(name).trim();
  emp.position = String(position).trim();
  emp.salary = salaryNum;
  saveData();
  return res.status(200).json(emp);
});

app.put("/api/employees/:id/status", (req, res) => {
  const emp = employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ success: false, message: "Employee not found" });

  emp.status = emp.status === "Active" ? "On Leave" : "Active";
  saveData();
  return res.status(200).json(emp);
});

app.delete("/api/employees/:id", (req, res) => {
  const exists = employees.some((e) => e.id === req.params.id);
  if (!exists) return res.status(404).json({ success: false, message: "Employee not found" });

  employees = employees.filter((e) => e.id !== req.params.id);
  saveData();
  return res.status(200).json({ success: true, message: "Employee deleted" });
});

// 404 สำหรับ route อื่น
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
