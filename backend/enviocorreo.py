import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuraciones (Cámbialas por tus datos reales)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "soporte.tecnico.gt058@gmail.com"  
SENDER_PASSWORD = "dous lvuk ogcd ngdw"


#--- Función para enviar el correo de verificación
def enviar_correo_verificacion(email_destino, nombre_usuario, codigo):
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = email_destino
    msg['Subject'] = "Código de Verificación - Sistema de Tráfico"
# Aquí puedes personalizar el diseño del correo con HTML y CSS en línea
    html = f"""
    <div style="font-family: sans-serif; max-width: 400px; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
        <h2 style="color: #16a085; text-align: center;">Seguridad de Acceso</h2>
        <p>Hola <strong>{nombre_usuario}</strong>,</p>
        <p>Tu código de verificación para ingresar al sistema es:</p>
        <div style="background: #f4f7f6; padding: 10px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; color: #2980b9; letter-spacing: 5px;">
            {codigo}
        </div>
        <p style="font-size: 12px; color: #888; margin-top: 20px; text-align: center;">
            Este código es de un solo uso. Si no fuiste tú, cambia tu contraseña.
        </p>
    </div>
    """
    msg.attach(MIMEText(html, 'html'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, email_destino, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error enviando correo: {e}")
        return False