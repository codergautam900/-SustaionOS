export const getAuthToken = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    return storedUser?.token || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token") || null;
  }
};

