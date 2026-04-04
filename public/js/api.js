const API_URL = 'http://localhost:8080/api'; 

// Get token
const getToken = () => localStorage.getItem('token');

// Common fetch function
const apiFetch = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    // Handle errors
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: "Server error" };
        }
        throw new Error(errorData.message || "Request failed");
    }

    return response.json();
};

// API methods
const api = {

    // 📦 Products
    getProducts: () => apiFetch('/products'),
    getAlerts: () => apiFetch('/products/alerts'),
    getInsights: () => apiFetch('/insights'),

    sellProduct: (id, quantity = 1) =>
        apiFetch(`/products/${id}/sell`, {
            method: 'POST',
            body: JSON.stringify({ quantity }),
        }),

    // 🔐 AUTH (✅ FIXED HERE)
    login: (email, password) =>
        apiFetch('/users/login', {   // ✅ FIXED
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    signup: (name, email, password) =>
        apiFetch('/users/signup', {  // ✅ FIXED
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        }),
};