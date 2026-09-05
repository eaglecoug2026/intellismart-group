<?php
/**
 * Intellismart Group - Send AI Readiness Report Email
 * POST endpoint to email the assessment report to user
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../includes/email_helper.php';
require_once __DIR__ . '/log-submission.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Required fields
$email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
$company = htmlspecialchars($input['company'] ?? 'Your Company');
$contact = htmlspecialchars($input['contact'] ?? '');
$score = intval($input['score'] ?? 0);
$level = htmlspecialchars($input['level'] ?? 'Emerging');
$levelColor = htmlspecialchars($input['levelColor'] ?? '#fbbf24');
$industry = htmlspecialchars($input['industry'] ?? 'General');
$opportunities = $input['opportunities'] ?? [];
$summary = $input['summary'] ?? [];

if (!$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Valid email required']);
    exit;
}

$firstName = explode(' ', $contact)[0] ?: 'there';

// Build opportunities HTML
$oppsHtml = '';
foreach ($opportunities as $opp) {
    $oppsHtml .= '<tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">' . htmlspecialchars($opp['title'] ?? '') . '</strong><br>
            <span style="color: #6b7280; font-size: 13px;">' . htmlspecialchars($opp['description'] ?? '') . '</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="background: ' . ($opp['impact'] === 'High' ? '#dcfce7' : '#fef3c7') . '; color: ' . ($opp['impact'] === 'High' ? '#166534' : '#92400e') . '; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">' . htmlspecialchars($opp['impact'] ?? 'Med') . '</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">' . htmlspecialchars($opp['effort'] ?? 'Med') . '</span>
        </td>
    </tr>';
}

// Build summary HTML
$summaryHtml = '';
foreach ($summary as $item) {
    $summaryHtml .= '<tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">' . htmlspecialchars($item['label'] ?? '') . '</td>
        <td style="padding: 8px 0; color: #1f2937; font-size: 13px; font-weight: 500; text-align: right;">' . htmlspecialchars($item['value'] ?? '') . '</td>
    </tr>';
}

// Build HTML email
$htmlBody = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="margin-bottom: 12px; color: #1f2937; font-size: 22px; font-weight: 800; letter-spacing: .02em;">Intellismart Group</div>
            <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Readiness Report</h1>
            <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">' . $company . ' - ' . $industry . '</p>
        </div>

        <!-- Score Card -->
        <div style="background: white; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="width: 120px; height: 120px; margin: 0 auto 16px; position: relative;">
                <svg width="120" height="120" style="transform: rotate(-90deg);">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" stroke-width="8"/>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="' . $levelColor . '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' . (2 * 3.14159 * 52) . '" stroke-dashoffset="' . (2 * 3.14159 * 52 * (1 - $score / 100)) . '"/>
                </svg>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 36px; font-weight: 800; color: #1f2937;">' . $score . '</div>
            </div>
            <div style="display: inline-block; background: ' . $levelColor . '20; color: ' . $levelColor . '; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 700;">' . $level . ' Readiness</div>
        </div>

        <!-- Opportunities -->
        <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 18px;">Top AI Opportunities</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Opportunity</th>
                        <th style="padding: 10px 16px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Impact</th>
                        <th style="padding: 10px 16px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Effort</th>
                    </tr>
                </thead>
                <tbody>' . $oppsHtml . '</tbody>
            </table>
        </div>

        <!-- Summary -->
        <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 18px;">Assessment Summary</h2>
            <table style="width: 100%;">' . $summaryHtml . '</table>
        </div>

        <!-- CTA -->
        <div style="background: linear-gradient(135deg, #6366f1, #7c3aed); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
            <h2 style="margin: 0 0 8px; color: white; font-size: 20px;">Ready to Put AI to Work?</h2>
            <p style="margin: 0 0 20px; color: rgba(255,255,255,0.8); font-size: 14px;">Book a free 15-minute strategy call to discuss your AI roadmap.</p>
            <a href="https://calendly.com/admin-intellismartco/30min" style="display: inline-block; background: white; color: #6366f1; padding: 14px 32px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px;">Book Strategy Call →</a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0 0 8px;">Sent by IntellismartGroup.com</p>
            <p style="margin: 0;">Questions? Email <a href="mailto:pohm@intellismartgroup.com" style="color: #6366f1;">pohm@intellismartgroup.com</a></p>
        </div>
    </div>
</body>
</html>';

// Plain text version
$textBody = "AI READINESS REPORT
$company · $industry

SCORE: $score% - $level Readiness

Hi $firstName,

Thanks for completing the AI Readiness Assessment for $company.

Your AI Readiness Score is $score% ($level level).

TOP OPPORTUNITIES:
";

foreach ($opportunities as $opp) {
    $textBody .= "- " . ($opp['title'] ?? '') . " (" . ($opp['impact'] ?? 'Med') . " Impact)\n";
}

$textBody .= "
NEXT STEP:
Book a free 15-minute strategy call to discuss your personalized AI roadmap.
https://calendly.com/admin-intellismartco/30min

Questions? Email pohm@intellismartgroup.com

Best,
The Intellismart Group Team
Intellismart Group
";

// Log submission
logSubmission($input);

// Send email with an internal BCC.
$subject = "$company's AI Readiness Score: $score%";
$result = sendEmail($email, $subject, $htmlBody, $textBody, 'pohm@intellismartgroup.com', 'pohm@intellismartgroup.com');

if ($result['success']) {
    echo json_encode(['success' => true, 'message' => 'Report sent successfully']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $result['error']]);
}
?>
