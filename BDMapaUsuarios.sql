--creamos la base de datos
CREATE DATABASE MapaRutas;
GO

--usamos la base de datos
USE MapaRutas;
GO

--creamos la tabla de rutas
CREATE TABLE Usuarios (
	Id INT IDENTITY(1,1)PRIMARY KEY,--clave primaria autoincremental
	Nombre NVARCHAR(100) NOT NULL, --nombre del usuario
	Correo NVARCHAR(100) NOT NULL UNIQUE, --correo del usuario, debe ser único
	password_hash NVARCHAR(Max) NOT NULL, --hash de la contraseña del usuario
	FechaRegistro DATETIME DEFAULT GETDATE() --fecha de registro del usuario, por defecto es la fecha actual
);
GO

