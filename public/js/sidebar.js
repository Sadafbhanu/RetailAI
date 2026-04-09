async function loadSidebar(activePage) {
    const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
    if (!sidebarPlaceholder) return;

    try {
        const res = await fetch("/sidebar.html");
        const html = await res.text();
        sidebarPlaceholder.innerHTML = html;
        sidebarPlaceholder.classList.add("sidebar");

        const activeLink = sidebarPlaceholder.querySelector(`[data-page="${activePage}"]`);
        if (activeLink) activeLink.classList.add("active");

        const userName = (localStorage.getItem("userName") || "User").trim();
        const userEl = sidebarPlaceholder.querySelector("#sidebarUserName");
        if (userEl) userEl.textContent = userName || "User";

        const logoutBtn = sidebarPlaceholder.querySelector("#sidebarLogoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                localStorage.removeItem("token");
                localStorage.removeItem("userName");
                window.location.href = "/pages/login.html";
            });
        }
    } catch (err) {
        console.error("Failed to load sidebar:", err);
    }
}
