$columns = @(
  @{ text = 'Severity'; type = 'string' },
  @{ text = 'DateTime'; type = 'time' },
  @{ text = 'User'; type = 'string' },
  @{ text = 'Computer'; type = 'string' },
  @{ text = 'Application'; type = 'string' },
  @{ text = 'Session'; type = 'number' },
  @{ text = 'Event'; type = 'string' },
  @{ text = 'Comment'; type = 'string' },
  @{ text = 'TransactionStatus'; type = 'string' },
  @{ text = 'TransactionDate'; type = 'time' },
  @{ text = 'TransactionNumber'; type = 'string' },
  @{ text = 'Metadata'; type = 'string' },
  @{ text = 'Data'; type = 'number' },
  @{ text = 'DataPresentation'; type = 'string' }
)

$baseDate = Get-Date '2026-03-19T10:47:03Z'
$rows = for ($i = 1; $i -le 1000; $i++) {
  $severity = if ($i % 3 -eq 0) { 'Error' } elseif ($i % 2 -eq 0) { 'Warning' } else { 'Info' }
  $computer = 'T-MON-PERF-AS-' + (($i % 7) + 1)
  $application = switch ($i % 4) {
    0 { 'BackgroundJob' }
    1 { 'Console' }
    2 { 'Client' }
    default { 'Service' }
  }
  $session = if ($i % 5 -eq 0) { 0 } else { 228556800 + $i }
  $event = switch ($i % 3) {
    0 { 'Transaction.Commit' }
    1 { 'Transaction.Start' }
    default { 'Session.End' }
  }
  $comment = if ($i % 2 -eq 0) { 'Session.End' } else { 'Test row ' + $i }
  $status = switch ($i % 4) {
    0 { 'Missing' }
    1 { 'Canceled' }
    2 { 'Success' }
    default { 'Processing' }
  }
  $date = $baseDate.AddSeconds($i).ToString('yyyy-MM-ddTHH:mm:ssZ')

  ,@(
    $severity,
    $date,
    'User 1',
    $computer,
    $application,
    $session,
    $event,
    $comment,
    $status,
    $date,
    [string](228556000 + $i),
    ('meta-' + $i),
    ($i % 10),
    ('payload-' + ($i % 20))
  )
}

$rawFrame = @(
  @{
    columns = $columns
    rows = $rows
  }
) | ConvertTo-Json -Depth 20 -AsArray

$rawFrame
