(function () {
  function apiFetch(path, options) {
    return request(path, options);
  }

  async function request(path, options) {
    const init = options || {};
    const headers = new Headers(init.headers || {});
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

    if (!isFormData && init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      credentials: "include",
      ...init,
      headers
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      const error = new Error(payload && payload.error ? payload.error : "请求失败，请稍后再试。");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function persistLocalUser(sessionPayload) {
    if (sessionPayload && sessionPayload.authenticated && sessionPayload.user) {
      localStorage.setItem("impeccable_user", sessionPayload.user.name);
      localStorage.setItem("impeccable_user_email", sessionPayload.user.email);
      localStorage.setItem("impeccable_user_role", sessionPayload.user.role || "user");
      return;
    }

    clearLocalUser();
  }

  async function syncSession() {
    try {
      const session = await apiFetch("/api/auth/session");
      persistLocalUser(session);
      return session;
    } catch (_error) {
      clearLocalUser();
      return { authenticated: false, user: null };
    }
  }

  async function requireAuth(redirectPath) {
    const session = await syncSession();
    if (!session.authenticated) {
      window.location.href = redirectPath || "login.html";
      throw new Error("AUTH_REQUIRED");
    }
    return session;
  }

  async function logout(redirectPath) {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearLocalUser();
      window.location.href = redirectPath || "index.html";
    }
  }

  function clearLocalUser() {
    localStorage.removeItem("impeccable_user");
    localStorage.removeItem("impeccable_user_email");
    localStorage.removeItem("impeccable_user_role");
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return month + "月" + day + "日 " + hours + ":" + minutes;
  }

  function showToast(message, type) {
    let host = document.getElementById("app-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "app-toast-host";
      host.className = "toast-host";
      document.body.appendChild(host);
    }

    const toast = document.createElement("div");
    toast.className = "toast toast-" + (type || "info");
    toast.innerHTML = '<span class="toast-icon">' + iconSvg(type === "error" ? "alert" : type === "success" ? "check" : "info") + '</span><span>' + escapeHtml(message || "操作已完成。") + "</span>";
    host.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 240);
    }, 3600);
  }

  function iconSvg(name) {
    const icons = {
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
      alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/></svg>',
      info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>',
      download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>',
      spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 9.5 9.5 2 13l7.5 3.5L13 24l3.5-7.5L24 13l-7.5-3.5L13 2Z"/></svg>',
      archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M6 7v13h12V7M9 11h6M5 3h14l1 4H4l1-4Z"/></svg>'
    };
    return icons[name] || icons.info;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getStoredUserName() {
    return localStorage.getItem("impeccable_user");
  }

  function applyRoleVisibility(sessionPayload) {
    const role = sessionPayload && sessionPayload.user ? sessionPayload.user.role : localStorage.getItem("impeccable_user_role");
    document.querySelectorAll("[data-admin-only]").forEach((element) => {
      element.style.display = role === "admin" ? "" : "none";
    });
  }

  function setUploadQueue(queue) {
    sessionStorage.setItem("impeccable_upload_queue", JSON.stringify(queue || []));
  }

  function getUploadQueue() {
    try {
      return JSON.parse(sessionStorage.getItem("impeccable_upload_queue") || "[]");
    } catch (_error) {
      return [];
    }
  }

  function setStyleConfig(config) {
    sessionStorage.setItem("impeccable_style_config", JSON.stringify(config || {}));
  }

  function getStyleConfig() {
    try {
      return JSON.parse(sessionStorage.getItem("impeccable_style_config") || "{}");
    } catch (_error) {
      return {};
    }
  }

  window.ImpeccableApp = {
    apiFetch: apiFetch,
    syncSession: syncSession,
    requireAuth: requireAuth,
    persistLocalUser: persistLocalUser,
    clearLocalUser: clearLocalUser,
    logout: logout,
    formatDateTime: formatDateTime,
    showToast: showToast,
    iconSvg: iconSvg,
    getStoredUserName: getStoredUserName,
    applyRoleVisibility: applyRoleVisibility,
    setUploadQueue: setUploadQueue,
    getUploadQueue: getUploadQueue,
    setStyleConfig: setStyleConfig,
    getStyleConfig: getStyleConfig
  };
})();
