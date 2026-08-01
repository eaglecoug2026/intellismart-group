<?php
/**
 * Intellismart Group - Log Test Submissions
 * Tracks all assessment completions with timestamp and details
 */

function logSubmission($data) {
    $logDir = __DIR__ . '/../logs';
    $logFile = $logDir . '/submissions.jsonl';
    
    // Create logs directory if it doesn't exist
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    // Prepare log entry
    $entry = [
        'timestamp' => date('c'),
        'date' => date('Y-m-d H:i:s'),
        'email' => $data['email'] ?? '',
        'company' => $data['company'] ?? '',
        'contact' => $data['contact'] ?? '',
        'industry' => $data['industry'] ?? '',
        'score' => $data['score'] ?? 0,
        'level' => $data['level'] ?? '',
        'teamSize' => $data['summary'][0]['value'] ?? '',
        'systems' => $data['summary'][1]['value'] ?? '',
        'manualHours' => $data['summary'][2]['value'] ?? '',
        'aiExperience' => $data['summary'][3]['value'] ?? '',
        'topGoal' => $data['summary'][4]['value'] ?? '',
        'budget' => $data['summary'][5]['value'] ?? '',
    ];
    
    // Append to log file (JSONL format - one JSON object per line)
    file_put_contents($logFile, json_encode($entry) . "\n", FILE_APPEND | LOCK_EX);
    
    return true;
}
?>
