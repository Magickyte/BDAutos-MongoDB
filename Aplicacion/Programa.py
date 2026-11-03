import customtkinter as ctk
from tkinter import ttk, messagebox, scrolledtext
import pymongo
import json
from Consultas import CONSULTAS

# ==========================================
# 0. CONFIGURACIÓN DE CUSTOMTKINTER
# ==========================================
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

# ==========================================
# 1. CONEXIÓN A LA BASE DE DATOS
# ==========================================
try:
    cliente = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = cliente["BDAutos"]
    cliente.server_info()
except Exception as e:
    print(f"Error al conectar a MongoDB: {e}")

tamanio_fuente_actual = 10

def cambiar_zoom(delta):
    """Aumenta o reduce el tamaño de la fuente en el área de texto"""
    global tamanio_fuente_actual
    tamanio_fuente_actual = max(8, min(32, tamanio_fuente_actual + delta))
    area_texto.config(font=("Consolas", tamanio_fuente_actual))

# ==========================================
# 3. INTERFAZ GRÁFICA (GUI) Y LÓGICA
# ==========================================
def mostrar_en_texto(mensaje):
    """Muestra texto (código o errores) en el área de texto de respaldo."""
    # Ocultar tabla y mostrar controles de zoom y área de texto
    tabla_resultados.pack_forget()
    scroll_x.pack_forget()
    scroll_y.pack_forget()
    
    frame_zoom.pack(side="top", fill="x", padx=5, pady=(5, 0))
    area_texto.pack(fill="both", expand=True, padx=5, pady=5)
    
    area_texto.configure(state="normal")
    area_texto.delete(1.0, "end")
    area_texto.insert("end", mensaje)
    area_texto.configure(state="disabled")

def contiene_estructuras_complejas(fila):
    return any(isinstance(val, (dict, list)) for val in fila.values())

def mostrar_codigo_mongo():
    seleccion = combo_consultas.get()
    
    if not seleccion:
        messagebox.showwarning("Advertencia", "Por favor, selecciona una consulta.")
        return
        
    coleccion, pipeline = CONSULTAS[seleccion]
    pipeline_json = json.dumps(pipeline, indent=4, ensure_ascii=False)
    codigo_completo = f"// Código de MongoDB para:\n// {seleccion}\n\ndb.{coleccion}.aggregate(\n{pipeline_json}\n)"
    
    lbl_conteo.configure(text="Mostrando código fuente")
    mostrar_en_texto(codigo_completo)

def ejecutar_consulta():
    seleccion = combo_consultas.get()
    
    if not seleccion:
        messagebox.showwarning("Advertencia", "Por favor, selecciona una consulta.")
        return

    tabla_resultados.delete(*tabla_resultados.get_children())
    
    try:
        coleccion, pipeline = CONSULTAS[seleccion]
        resultado_cursor = db[coleccion].aggregate(pipeline)
        resultados = list(resultado_cursor)
        
        lbl_conteo.configure(text=f"Registros encontrados: {len(resultados)}")
        
        if not resultados:
            mostrar_en_texto("La consulta no devolvió resultados.")
            return

        if contiene_estructuras_complejas(resultados[0]):
            json_formateado = json.dumps(resultados, indent=4, ensure_ascii=False, default=str)
            mostrar_en_texto(f"Esta consulta contiene datos anidados (arreglos/objetos) que no se pueden tabular:\n\n{json_formateado}")
            return

        # Ocultar controles de zoom y área de texto, mostrar tabla
        frame_zoom.pack_forget()
        area_texto.pack_forget()
        
        scroll_y.pack(side="right", fill="y")
        scroll_x.pack(side="bottom", fill="x")
        tabla_resultados.pack(side="left", fill="both", expand=True)

        columnas = list(resultados[0].keys())
        
        if not isinstance(resultados[0], dict):
            columnas = ["Resultado"]
            resultados = [{"Resultado": r} for r in resultados]

        tabla_resultados["columns"] = columnas
        tabla_resultados["show"] = "headings"

        for col in columnas:
            tabla_resultados.heading(col, text=str(col).capitalize())
            tabla_resultados.column(col, width=150, minwidth=100, anchor="center")

        for fila in resultados:
            valores = [str(fila.get(col, "")) for col in columnas]
            tabla_resultados.insert("", "end", values=valores)
            
    except Exception as e:
        mostrar_en_texto(f"Error al ejecutar la consulta:\n{e}")

# ==========================================
# CREACIÓN DE VENTANA PRINCIPAL
# ==========================================
ventana = ctk.CTk()
ventana.title("Consultas BDAutos - MongoDB")
ventana.geometry("900x650")

main_frame = ctk.CTkFrame(ventana, fg_color="transparent")
main_frame.pack(fill="both", expand=True, padx=15, pady=15)

lbl_instruccion = ctk.CTkLabel(main_frame, text="Selecciona la consulta que deseas ejecutar:", font=("Arial", 14, "bold"))
lbl_instruccion.pack(anchor="w", pady=(0, 5))

combo_consultas = ctk.CTkComboBox(main_frame, values=list(CONSULTAS.keys()), font=("Arial", 12), state="readonly")
combo_consultas.pack(fill="x", pady=5)
if CONSULTAS:
    combo_consultas.set(list(CONSULTAS.keys())[0])

frame_botones = ctk.CTkFrame(main_frame, fg_color="transparent")
frame_botones.pack(pady=10)

btn_ver_codigo = ctk.CTkButton(frame_botones, text="Ver Código Mongo", fg_color="#2196F3", hover_color="#1976D2", font=("Arial", 12, "bold"), command=mostrar_codigo_mongo)
btn_ver_codigo.pack(side="left", padx=10)

btn_ejecutar = ctk.CTkButton(frame_botones, text="Ejecutar Consulta", fg_color="#4CAF50", hover_color="#388E3C", font=("Arial", 12, "bold"), command=ejecutar_consulta)
btn_ejecutar.pack(side="left", padx=10)

lbl_conteo = ctk.CTkLabel(main_frame, text="Registros encontrados: 0", font=("Arial", 12, "bold"), text_color="#2196F3")
lbl_conteo.pack(anchor="w", pady=(5, 0))

# ==========================================
# CONTENEDOR DE RESULTADOS
# ==========================================
frame_resultados = ctk.CTkFrame(main_frame)
frame_resultados.pack(fill="both", expand=True, pady=10)

# Barra de herramientas de Zoom (Arriba dentro del contenedor de resultados)
frame_zoom = ctk.CTkFrame(frame_resultados, fg_color="transparent")
btn_zoom_mas = ctk.CTkButton(frame_zoom, text=" A+ ", width=40, font=("Arial", 10, "bold"), command=lambda: cambiar_zoom(2))
btn_zoom_mas.pack(side="right", padx=2)
btn_zoom_menos = ctk.CTkButton(frame_zoom, text=" A- ", width=40, font=("Arial", 10, "bold"), command=lambda: cambiar_zoom(-2))
btn_zoom_menos.pack(side="right", padx=2)
lbl_zoom_titulo = ctk.CTkLabel(frame_zoom, text="Tamaño de texto:", font=("Arial", 10))
lbl_zoom_titulo.pack(side="right", padx=5)

# Scrollbars y Tabla para los resultados tabulares
scroll_y = ttk.Scrollbar(frame_resultados, orient="vertical")
scroll_x = ttk.Scrollbar(frame_resultados, orient="horizontal")

style = ttk.Style()
style.theme_use("clam")
style.configure("Treeview", font=("Arial", 10), rowheight=25)
style.configure("Treeview.Heading", font=("Arial", 10, "bold"))

tabla_resultados = ttk.Treeview(frame_resultados, yscrollcommand=scroll_y.set, xscrollcommand=scroll_x.set)
scroll_y.config(command=tabla_resultados.yview)
scroll_x.config(command=tabla_resultados.xview)

# Área de texto para código/errores
area_texto = scrolledtext.ScrolledText(frame_resultados, wrap="word", font=("Consolas", tamanio_fuente_actual), bg="#f4f4f4", state="disabled")

# Iniciar aplicación
ventana.mainloop()