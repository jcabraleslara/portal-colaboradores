# Script para renombrar archivos en OneDrive local
# Elimina el sufijo numerico (_1, _2, etc.) de archivos con formato estandarizado

$carpeta = "C:\OneDrive - GESTARSALUD DE COLOMBIA IPS SAS\Soportes Facturacion"

Write-Host "=== BUSCANDO ARCHIVOS ===" -ForegroundColor Cyan
Write-Host "Carpeta: $carpeta" -ForegroundColor Gray

# Buscar archivos con el patron: PREFIJO_NIT_ID_N.ext
$archivos = Get-ChildItem -Path $carpeta -Recurse -File | Where-Object {
    $_.Name -match '^[A-Z]{2,4}_\d{9}_[A-Z]{2}\d+_\d+\.(pdf|jpg|png)$'
}

Write-Host "Archivos encontrados: $($archivos.Count)" -ForegroundColor Yellow

if ($archivos.Count -eq 0) {
    Write-Host "No se encontraron archivos para renombrar." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "=== VISTA PREVIA ===" -ForegroundColor Cyan

foreach ($archivo in $archivos) {
    $nuevoNombre = $archivo.Name -replace '_\d+(\.[^.]+)$', '$1'
    Write-Host "$($archivo.Name) -> $nuevoNombre" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Presiona ENTER para ejecutar el renombrado, o CTRL+C para cancelar..." -ForegroundColor Green
Read-Host

Write-Host ""
Write-Host "=== RENOMBRANDO ===" -ForegroundColor Cyan

$exitosos = 0
$errores = 0

foreach ($archivo in $archivos) {
    $nuevoNombre = $archivo.Name -replace '_\d+(\.[^.]+)$', '$1'
    $nuevaRuta = Join-Path -Path $archivo.DirectoryName -ChildPath $nuevoNombre

    try {
        # Verificar si el archivo destino ya existe
        if (Test-Path $nuevaRuta) {
            Write-Host "SKIP: $($archivo.Name) - El destino ya existe" -ForegroundColor DarkYellow
            continue
        }

        Rename-Item -Path $archivo.FullName -NewName $nuevoNombre -ErrorAction Stop
        Write-Host "OK: $($archivo.Name) -> $nuevoNombre" -ForegroundColor Green
        $exitosos++
    } catch {
        Write-Host "ERROR: $($archivo.Name) - $($_.Exception.Message)" -ForegroundColor Red
        $errores++
    }
}

Write-Host ""
Write-Host "=== COMPLETADO ===" -ForegroundColor Cyan
Write-Host "Exitosos: $exitosos" -ForegroundColor Green
Write-Host "Errores: $errores" -ForegroundColor $(if ($errores -gt 0) { "Red" } else { "Green" })
