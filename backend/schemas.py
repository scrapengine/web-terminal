from pydantic import BaseModel
from typing import Optional, List

# User schemas
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str

# SSH Host schemas
class SSHHostCreate(BaseModel):
    host: str
    port: int = 22
    username: str

class SSHHostResponse(BaseModel):
    id: int
    host: str
    port: int
    username: str
    user_id: int
    
    class Config:
        from_attributes = True

# SSH Connection schemas (dari kode sebelumnya)
class SSHConnection(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str

class SSHCommand(BaseModel):
    session_id: str
    command: str

# QuickCommand schemas
class QuickCommandBase(BaseModel):
    name: str
    command: str
    category: str = "custom"
    sort_order: int = 0

class QuickCommandCreate(QuickCommandBase):
    pass

class QuickCommandUpdate(QuickCommandBase):
    id: int

class QuickCommandResponse(QuickCommandBase):
    id: int
    user_id: int
    is_default: bool
    
    class Config:
        from_attributes = True