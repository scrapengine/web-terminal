# 🚀 Web Terminal

> SSH Client berbasis Web - Kelola server SSH langsung dari browser!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/Python-3.12-green)
![React](https://img.shields.io/badge/React-18.2-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## ✨ **Fitur Unggulan**

| 💻 **Multi-Tab** | 🔐 **Saved Hosts** | ⚡ **Quick Commands** |
|:---:|:---:|:---:|
| Buka banyak server sekaligus | Simpan & kelola host favorit | Eksekusi perintah cepat |
| 1 host bisa multiple tab | Edit & hapus saved hosts | Copy & execute langsung |

| 🖥️ **Local Terminal** | 📱 **Mobile Ready** | 🔄 **Auto Reconnect** |
|:---:|:---:|:---:|
| Windows PowerShell | Touch friendly | Keep connection alive |
| Linux/macOS bash | Floating copy/paste | Auto reconnect |

---

## 🎯 **Preview**

```bash
# Koneksi ke server test.rebex.net
Connected to test.rebex.net
For a list of supported commands, type 'help'.
demo@test:/$ ls -la
total 12
drwxr-xr-x 3 demo users 4096 Jan 15 10:30 .
drwxr-xr-x 5 demo users 4096 Jan 15 10:30 ..
-rw-r--r-- 1 demo users  220 Jan 15 10:30 .bash_logout
-rw-r--r-- 1 demo users 3526 Jan 15 10:30 .bashrc
drwxr-xr-x 3 demo users 4096 Jan 15 10:30 pub
-rw-r--r-- 1 demo users  807 Jan 15 10:30 readme.txt
demo@test:/$
```

---

## 🚀 **Cara Install**

### **Backend**
```bash
# Clone & setup
git clone https://github.com/scrapengine/web-terminal.git
cd web-terminal

# Virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Install dependencies
cd backend
pip install -r requirements.txt

# Jalankan backend
uvicorn main:app --reload
```

### **Frontend**
```bash
cd frontend
npm install
npm start
```

### **Docker (Opsional)**
```bash
docker-compose up --build
```

---

## 🎮 **Cara Pakai**

1. **Register** akun baru
2. **Login** dengan akun yang dibuat
3. **Add Host** (simpan server SSH)
4. **Klik saved host** → auto connect
5. **Buka multi-tab** untuk server yang sama
6. **Gunakan quick commands** untuk perintah cepat

---

## 📸 **Screenshot**

| Login Page | Terminal | Quick Commands |
|:---:|:---:|:---:|
| *[Gambar Login]* | *[Gambar Terminal]* | *[Gambar QuickCmd]* |

---

## 🛠️ **Teknologi**

| Bagian | Teknologi |
|--------|-----------|
| **Backend** | FastAPI, asyncssh, pywinpty, SQLAlchemy |
| **Frontend** | React, Material-UI, XTerm.js |
| **Database** | SQLite |
| **WebSocket** | Real-time terminal communication |

---

## 📦 **Requirements**

- Python 3.12+
- Node.js 18+
- npm atau yarn
- Docker (opsional)

---

## 🤝 **Kontribusi**

Pull request sangat diterima. Untuk perubahan besar, buka issue dulu ya.

---

## 📄 **Lisensi**

Project ini dilisensikan di bawah [MIT License](LICENSE)

---

## ⭐ **Support**

Jika project ini bermanfaat, jangan lupa kasih ⭐ ya!

---

**Made with ❤️ by [scrapengine](https://github.com/scrapengine)** © 2026
