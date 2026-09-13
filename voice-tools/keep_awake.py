"""Empêche la mise en veille automatique tant que bank_gen.py tourne (même principe qu'un lecteur vidéo).

Ne modifie aucun réglage Windows : la demande disparaît dès que ce script s'arrête.
Un capot fermé ou un « Mettre en veille » manuel restent prioritaires.
"""
import ctypes
import subprocess
import time

ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
CHECK = ("(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and "
         "$_.CommandLine -match 'bank_gen' }).Count")

ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
print(time.strftime("%H:%M:%S"), "veille bloquée pendant la génération", flush=True)
try:
    while True:
        n = subprocess.run(["powershell", "-NoProfile", "-Command", CHECK], capture_output=True, text=True).stdout.strip()
        if n in ("", "0"):
            break
        time.sleep(60)
finally:
    ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
    print(time.strftime("%H:%M:%S"), "génération terminée, veille de nouveau autorisée", flush=True)
