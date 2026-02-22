from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

    ssh_hosts = relationship("SSHHost", back_populates="owner")
    quick_commands = relationship("QuickCommand", back_populates="owner")  # ✅ TAMBAH


class SSHHost(Base):
    __tablename__ = "ssh_hosts"

    id = Column(Integer, primary_key=True, index=True)
    host = Column(String)
    port = Column(Integer, default=22)
    username = Column(String)
    password = Column(String)  # plaintext (dev mode)

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="ssh_hosts")


# ✅ NEW TABLE: QuickCommand
class QuickCommand(Base):
    __tablename__ = "quick_commands"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)          # Nama command (misal: "List Files")
    command = Column(Text, nullable=False)              # Perintah SSH (misal: "ls -la")
    category = Column(String(50), default="custom")     # Kategori: file, system, process, network, custom
    sort_order = Column(Integer, default=0)              # Urutan tampilan
    is_default = Column(Boolean, default=False)          # Command bawaan atau custom

    owner = relationship("User", back_populates="quick_commands")