document.addEventListener('DOMContentLoaded', () => {
    const userNameEl = document.getElementById('user-name');

    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName');

    if (!token) {
        window.location.href = '/pages/login.html'; // Redirect to login if not authenticated
        return;
    }

    // --- If token exists, show dashboard ---
    userNameEl.textContent = `Welcome, ${userName || 'User'}`;

    const inventoryBody = document.getElementById('inventory-table-body');
    const lowStockTrendsList = document.getElementById('low-stock-trends-list');
    const dateTimeDiv = document.getElementById('current-datetime');

    // Metric cards
    const totalValueEl = document.getElementById('total-value');
    const expiryAlertsEl = document.getElementById('expiry-alerts');
    const lowStockAlertsEl = document.getElementById('low-stock-alerts');

    // --- Data Fetching and Rendering ---

    const renderProducts = (products) => {
        inventoryBody.innerHTML = '';
        let totalValue = 0;

        products.forEach(product => {
            totalValue += (product.quantity || 0) * (product.price || 0);

            const freshness = product.freshnessIndex ? (product.freshnessIndex * 100).toFixed(0) : 'N/A';
            let statusBadge;
            if (freshness < 10 && freshness !== 'N/A') {
                statusBadge = '<span class="status-badge status-expired">Expired</span>';
            } else if (product.quantity < product.minThreshold) {
                statusBadge = '<span class="status-badge status-warning">Low Stock</span>';
            } else {
                statusBadge = '<span class="status-badge status-safe">Safe</span>';
            }

            const row = `<tr>
                <td>${product.name}</td>
                <td>${product.quantity}</td>
                <td>$${(product.price || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button class="action-btn" onclick="handleSellProduct('${product._id}')" title="Quick Sell">
                        <i class="fas fa-dollar-sign"></i>
                    </button>
                    <button class="action-btn" onclick="handleRestockProduct('${product._id}')" title="Restock">
                        <i class="fas fa-box-open"></i>
                    </button>
                </td>
            </tr>`;
            inventoryBody.innerHTML += row;
        });
    };

    const renderAlerts = (alerts) => {
        const lowStockCount = alerts.filter(a => a.reason.includes('Low stock')).length;
        const expiryCount = alerts.length - lowStockCount;

        lowStockAlertsEl.textContent = lowStockCount;
        expiryAlertsEl.textContent = expiryCount;
    };

    const renderMetrics = (products, alerts) => {
        const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
        totalValueEl.textContent = `$${totalValue.toFixed(2)}`;
    };

    const renderInsights = (insights) => {
        lowStockTrendsList.innerHTML = '';
        // This is a placeholder; you would filter insights by type from the backend
        insights.forEach(insight => {
            const item = `<li class="list-group-item"><strong>${insight.name}:</strong> ${insight.suggestion} (Avg daily sales: ${insight.avgDailySales})</li>`;
            lowStockTrendsList.innerHTML += item;
        });
    };

    // --- UI Updates ---

    const updateDateTime = () => {
        dateTimeDiv.textContent = new Date().toLocaleString();
    };

    // --- Event Handlers ---

    window.handleSellProduct = async (id) => {
        await api.sellProduct(id);
        loadDashboard();
    };

    window.handleRestockProduct = async (id) => {
        // TODO: Implement logic to show a modal to add stock.
        console.log('Restocking product:', id);
    };

    // --- Initial Load ---

    const loadDashboard = async () => {
        try {
            const [products, alerts, insights] = await Promise.all([
                api.getProducts(),
                api.getAlerts(),
                api.getInsights()
            ]);
            renderProducts(products); // Also calculates total value
            renderMetrics(products, alerts);
            renderAlerts(alerts); // Populates alert cards
            renderInsights(insights);
        } catch (error) {
            console.error("Failed to load dashboard data:", error.message);
            if (error.message.includes('401') || error.message.includes('403')) {
                // If token is invalid or expired, redirect to login
                window.location.href = '/pages/login.html';
            }
        }
    };

    loadDashboard();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});