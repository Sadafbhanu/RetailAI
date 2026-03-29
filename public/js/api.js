// A simple API layer

const API_URL = '/api';

// Function to get the JWT token from localStorage
const getToken = () => localStorage.getItem('token');

const apiFetch = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
         let errorData;
        const responseClone = response.clone(); // Clone the response
        try {
            errorData = await response.json(); // Try reading the original
        } catch (e) {
            // If response is not JSON, try to get text or provide a generic message
            errorData = { message: await responseClone.text() || `Server error: ${response.statusText}` }; // Read the clone as a fallback
        }
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

const api = {
    getProducts: () => apiFetch('/products'),
    getAlerts: () => apiFetch('/products/alerts'),
    
    getInsights: () => apiFetch('/insights'),
    sellProduct: (id, quantity = 1) =>
        apiFetch(`/products/${id}/sell`, {
            method: 'POST',
            body: JSON.stringify({ quantity }),
        }),
    login: (email, password) => apiFetch('/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    }),
    signup: (name, email, password) => apiFetch('/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    }),
};