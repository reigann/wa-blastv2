$contacts = @(
    @{name="Budi"; phone="+62812345670"; minat_prodi="Teknik Informatika"; asal_sekolah="SMA Negeri 1 Jakarta"},
    @{name="Siti"; phone="+62812345671"; minat_prodi="Ilmu Komputer"; asal_sekolah="SMA Negeri 5 Bandung"},
    @{name="Ahmad"; phone="+62812345672"; minat_prodi="Sistem Informasi"; asal_sekolah="SMA Negeri 2 Surabaya"},
    @{name="Dewi"; phone="+62812345673"; minat_prodi="Teknik Informatika"; asal_sekolah="SMA Negeri 8 Jakarta"},
    @{name="Rudi"; phone="+62812345674"; minat_prodi="Ilmu Komputer"; asal_sekolah="SMA Negeri 4 Medan"},
    @{name="Linda"; phone="+62812345675"; minat_prodi="Sistem Informasi"; asal_sekolah="SMA Negeri 3 Bandung"},
    @{name="Hendra"; phone="+62812345676"; minat_prodi="Teknik Informatika"; asal_sekolah="SMA Negeri 1 Jakarta"},
    @{name="Maya"; phone="+62812345677"; minat_prodi="Ilmu Komputer"; asal_sekolah="SMA Negeri 7 Surabaya"}
);

foreach ($c in $contacts) {
    $body = $c | ConvertTo-Json;
    Invoke-RestMethod -Uri "http://localhost:3001/api/contacts" -Method Post -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction SilentlyContinue | Out-Null;
    Write-Host "Added: $($c.name)"
}
