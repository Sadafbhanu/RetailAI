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
    } catch (err) {
        console.error("Failed to load sidebar:", err);
    }
}
