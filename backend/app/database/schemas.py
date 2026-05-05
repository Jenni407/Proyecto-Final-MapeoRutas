from pydantic import BaseModel, EmailStr

class UsuarioLogin(BaseModel):
    Nombre: str
    Password: str 
    
# Esquema para REGISTRO 
class UsuarioCreate(UsuarioLogin):
    Correo: str

class UsuarioResponse(BaseModel):
    Id: int
    Nombre: str
    Correo: str
class RecuperarRequest(BaseModel):
    Correo: str

class ResetPasswordRequest(BaseModel):
    Correo: str
    Codigo: str
    NuevaPassword: str
    
    class Config:
        from_attributes = True