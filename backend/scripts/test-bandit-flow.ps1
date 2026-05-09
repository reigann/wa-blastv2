# 🧪 Quick Test Script untuk Bandit Analytics (Windows)
# Usage: powershell -ExecutionPolicy Bypass -File backend\scripts\test-bandit-flow.ps1

param(
    [string]$BaseUrl = "http://localhost:3001"
)

Write-Host "🚀 Starting Bandit Analytics Flow Test..." -ForegroundColor Green
Write-Host ""

# 1. Create Policy
Write-Host "1️⃣  Creating Bandit Policy..." -ForegroundColor Cyan

$policyBody = @{
    name = "Test Campaign Flow"
    arms = 2
    features = @("hour", "user_segment")
    alpha = 1.0
    lambda = 1.0
} | ConvertTo-Json

$policy = Invoke-WebRequest -Uri "$BaseUrl/api/bandit/create" `
    -Method POST `
    -ContentType "application/json" `
    -Body $policyBody | ConvertFrom-Json

$policyId = $policy.policy.id
Write-Host "✓ Policy created with ID: $policyId" -ForegroundColor Green
Write-Host ""

# 2. Get Recommendation 1
Write-Host "2️⃣  Getting Recommendation (Event 1)..." -ForegroundColor Cyan

$rec1Body = @{
    policy_id = [int]$policyId
    context = @{
        hour = 10
        user_segment = 1
    }
    phone = "+6281234567890"
} | ConvertTo-Json

$rec1 = Invoke-WebRequest -Uri "$BaseUrl/api/bandit/recommend" `
    -Method POST `
    -ContentType "application/json" `
    -Body $rec1Body | ConvertFrom-Json

$eventId1 = $rec1.eventId
$arm1 = $rec1.arm
Write-Host "✓ Recommendation: Event $eventId1 → Arm $arm1" -ForegroundColor Green
Write-Host ""

# 3. Get Recommendation 2
Write-Host "3️⃣  Getting Recommendation (Event 2)..." -ForegroundColor Cyan

$rec2Body = @{
    policy_id = [int]$policyId
    context = @{
        hour = 14
        user_segment = 2
    }
    phone = "+6287654321098"
} | ConvertTo-Json

$rec2 = Invoke-WebRequest -Uri "$BaseUrl/api/bandit/recommend" `
    -Method POST `
    -ContentType "application/json" `
    -Body $rec2Body | ConvertFrom-Json

$eventId2 = $rec2.eventId
$arm2 = $rec2.arm
Write-Host "✓ Recommendation: Event $eventId2 → Arm $arm2" -ForegroundColor Green
Write-Host ""

# 4. Update Delivery Status for Event 1
Write-Host "4️⃣  Updating Event 1 Status (DELIVERED)..." -ForegroundColor Cyan

$status1Body = @{
    event_id = [int]$eventId1
    delivery_status = "delivered"
    read_status = 1
    reply_received = 0
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BaseUrl/api/bandit/update-delivery-status" `
    -Method POST `
    -ContentType "application/json" `
    -Body $status1Body | Out-Null

Write-Host "✓ Event 1 marked as delivered & read" -ForegroundColor Green
Write-Host ""

# 5. Update Delivery Status for Event 2
Write-Host "5️⃣  Updating Event 2 Status (FAILED)..." -ForegroundColor Cyan

$status2Body = @{
    event_id = [int]$eventId2
    delivery_status = "failed"
    read_status = 0
    reply_received = 0
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BaseUrl/api/bandit/update-delivery-status" `
    -Method POST `
    -ContentType "application/json" `
    -Body $status2Body | Out-Null

Write-Host "✓ Event 2 marked as failed" -ForegroundColor Green
Write-Host ""

# 6. Add more events
Write-Host "6️⃣  Adding more events for richer analytics..." -ForegroundColor Cyan

for ($i = 3; $i -le 5; $i++) {
    $hour = 10 + $i
    $segment = 1 + ($i % 2)
    
    $recBody = @{
        policy_id = [int]$policyId
        context = @{
            hour = $hour
            user_segment = $segment
        }
    } | ConvertTo-Json
    
    Invoke-WebRequest -Uri "$BaseUrl/api/bandit/recommend" `
        -Method POST `
        -ContentType "application/json" `
        -Body $recBody | Out-Null
    
    Write-Host "  • Event $i created" -ForegroundColor Gray
}
Write-Host ""

# 7. Get Analytics
Write-Host "7️⃣  Fetching Analytics..." -ForegroundColor Cyan

$analytics = Invoke-WebRequest -Uri "$BaseUrl/api/bandit/analytics/$policyId" `
    -Method GET | ConvertFrom-Json

Write-Host "✓ Analytics retrieved:" -ForegroundColor Green
$analytics.analytics | ConvertTo-Json | Write-Host
Write-Host ""

# 8. Display Summary
Write-Host "8️⃣  Test Summary:" -ForegroundColor Cyan
Write-Host "✓ Policy ID: $policyId" -ForegroundColor Green
Write-Host "✓ Event 1 (Arm $arm1): Delivered & Read" -ForegroundColor Green
Write-Host "✓ Event 2 (Arm $arm2): Failed" -ForegroundColor Green
Write-Host "✓ Total Events: 5" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open browser: http://localhost:5173/bandit" -ForegroundColor Yellow
Write-Host "2. Select policy: 'Test Campaign Flow'" -ForegroundColor Yellow
Write-Host "3. Check analytics charts" -ForegroundColor Yellow
Write-Host "4. Verify arm statistics are displayed" -ForegroundColor Yellow
Write-Host ""

Write-Host "✅ Test Complete!" -ForegroundColor Green
