  async function loadVersion() {
    try {
      const res = await fetch("/api/version");
      const data = await res.json();

      document.getElementById("version").textContent =
        "v" + data.version;
    } catch (err) {
      console.error(err);

      document.getElementById("version").textContent =
        "version unavailable";
    }
  }

  loadVersion();