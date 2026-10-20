import { Alert, Platform } from "react-native";

// ⚠️ URL ของ backend บนเซิร์ฟเวอร์
export const API_URL = "http://119.59.102.161:3107";

export type Employee = {
  id: string;
  name: string;
  position: string;
  status: "Active" | "On Leave";
  salary: number;
};

export type Cluster = {
  group: string;
  centroid: number;
  count: number;
};

// เก็บ token ไว้ในหน่วยความจำของแอป (รีเฟรชหน้าเว็บแล้วต้อง login ใหม่)
let authToken: string | null = null;

export const setToken = (token: string | null) => {
  authToken = token;
};

export const getToken = () => authToken;

export const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${authToken ?? ""}`,
});

// Alert.alert ที่มีปุ่มไม่ทำงานบนเว็บ จึงใช้ window.alert / window.confirm แทน
export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

export function confirmDialog(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}
