import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  API_URL,
  Cluster,
  Employee,
  authHeaders,
  confirmDialog,
  getToken,
  setToken,
  showAlert,
} from "../lib/api";

export default function DashboardScreen() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [salary, setSalary] = useState("");
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const logout = () => {
    setToken(null);
    router.replace("/");
  };

  const fetchEmployees = async (keyword: string = search) => {
    try {
      const q = keyword.trim();
      const url = q
        ? `${API_URL}/api/employees?search=${encodeURIComponent(q)}`
        : `${API_URL}/api/employees`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 401) return logout();
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      showAlert("Error", "Failed to load employees");
    }
  };

  // ค้นหาอัตโนมัติเมื่อพิมพ์ (รอ 300ms หลังหยุดพิมพ์)
  useEffect(() => {
    if (!getToken()) return;
    const timer = setTimeout(() => fetchEmployees(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ยังไม่ login → กลับไปหน้า Login
  if (!getToken()) return <Redirect href="/" />;

  const resetForm = () => {
    setName("");
    setPosition("");
    setSalary("");
    setEditingId(null);
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setName(emp.name);
    setPosition(emp.position);
    setSalary(String(emp.salary));
  };

  const handleSubmit = async () => {
    // Client-side validation
    if (!name.trim() || !position.trim() || !salary.trim()) {
      showAlert("Validation Error", "Please fill in name, position and salary");
      return;
    }
    const salaryNum = Number(salary);
    if (!Number.isFinite(salaryNum) || salaryNum < 0) {
      showAlert("Validation Error", "Salary must be a valid number");
      return;
    }
    try {
      const isEdit = editingId !== null;
      const res = await fetch(
        isEdit ? `${API_URL}/api/employees/${editingId}` : `${API_URL}/api/employees`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            name: name.trim(),
            position: position.trim(),
            salary: salaryNum,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showAlert("Error", data.message || "Failed to save employee");
        return;
      }
      resetForm();
      setClusters(null); // ข้อมูลเปลี่ยน ผลวิเคราะห์เดิมไม่ตรงแล้ว
      fetchEmployees();
    } catch (err) {
      showAlert("Error", "Failed to save employee");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/employees/${id}/status`, {
        method: "PUT",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        showAlert("Error", data.message || "Failed to update status");
      }
      fetchEmployees();
    } catch (err) {
      showAlert("Error", "Failed to update status");
    }
  };

  const handleDelete = (emp: Employee) => {
    confirmDialog("Confirm Delete", `Are you sure you want to delete ${emp.name}?`, async () => {
      try {
        const res = await fetch(`${API_URL}/api/employees/${emp.id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!res.ok) {
          const data = await res.json();
          showAlert("Error", data.message || "Failed to delete employee");
        }
        if (editingId === emp.id) resetForm();
        setClusters(null);
        fetchEmployees();
      } catch (err) {
        showAlert("Error", "Failed to delete employee");
      }
    });
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setClusters(null);
    try {
      const res = await fetch(`${API_URL}/api/employees/salary-clusters`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClusters(data.clusters);
      } else {
        showAlert("Error", data.message || "Failed to analyze salaries");
      }
    } catch (err) {
      showAlert("Error", "Failed to analyze salaries");
    } finally {
      setAnalyzing(false);
    }
  };

  const renderEmployee = ({ item }: { item: Employee }) => {
    const active = item.status === "Active";
    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.empName}>{item.name}</Text>
          <Text style={styles.empPos}>{item.position}</Text>
          <Text style={styles.empSalary}>฿ {Number(item.salary).toLocaleString()}</Text>
          <Text style={[styles.badge, active ? styles.badgeActive : styles.badgeLeave]}>
            {item.status}
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
            <Text style={styles.btnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggle(item.id)}>
            <Text style={styles.btnText}>Toggle Status</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Text style={styles.btnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Add Employee Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {editingId ? `Edit Employee #${editingId}` : "Add Employee"}
        </Text>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Position"
          value={position}
          onChangeText={setPosition}
        />
        <TextInput
          style={styles.input}
          placeholder="Salary"
          keyboardType="numeric"
          value={salary}
          onChangeText={setSalary}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
          <Text style={styles.btnText}>{editingId ? "Save Changes" : "Add Employee"}</Text>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Salary Analytics (K-Means) */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
          <Text style={styles.btnText}>Analyze Salary Structure</Text>
        </TouchableOpacity>
        {analyzing && <ActivityIndicator size="large" style={{ marginTop: 12 }} />}
        {clusters && clusters.length === 0 && (
          <Text style={styles.empty}>No salary data to analyze</Text>
        )}
        {clusters && clusters.length > 0 && (
          <View style={styles.clusterRow}>
            {clusters.map((c) => (
              <View key={c.group} style={styles.clusterCard}>
                <Text style={styles.clusterTier}>{c.group}</Text>
                <Text style={styles.clusterLabel}>Employees</Text>
                <Text style={styles.clusterValue}>{c.count}</Text>
                <Text style={styles.clusterLabel}>Avg Salary</Text>
                <Text style={styles.clusterValue}>฿ {Number(c.centroid).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Employees ({employees.length})</Text>
      <TextInput
        style={styles.input}
        placeholder="Search by name, position or status..."
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={employees}
        keyExtractor={(item) => item.id}
        renderItem={renderEmployee}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.empty}>{search.trim() ? "No matching employees" : "No employees"}</Text>
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  list: { padding: 16, paddingTop: 48, paddingBottom: 40, width: "100%", maxWidth: 800, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  logout: { color: "#dc2626", fontWeight: "600" },
  section: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 10, color: "#111827" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    color: "#111827",
  },
  primaryBtn: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  analyzeBtn: { backgroundColor: "#7c3aed", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  empName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  empPos: { color: "#4b5563", marginTop: 2 },
  empSalary: { marginTop: 4, fontWeight: "600", color: "#111827" },
  badge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    overflow: "hidden",
  },
  badgeActive: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeLeave: { backgroundColor: "#fef3c7", color: "#92400e" },
  actions: { gap: 6 },
  editBtn: {
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  cancelBtn: { padding: 12, alignItems: "center", marginTop: 6 },
  cancelText: { color: "#6b7280", fontWeight: "600" },
  toggleBtn: {
    backgroundColor: "#0891b2",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  deleteBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  clusterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  clusterCard: {
    flexGrow: 1,
    flexBasis: 90,
    backgroundColor: "#ede9fe",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  clusterTier: { fontSize: 16, fontWeight: "700", color: "#5b21b6", marginBottom: 6 },
  clusterLabel: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  clusterValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
  empty: { textAlign: "center", color: "#6b7280", marginVertical: 12 },
});
