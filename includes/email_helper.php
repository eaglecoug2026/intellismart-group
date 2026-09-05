<?php
/**
 * Intellismart Group email helper.
 *
 * Configure these environment variables on the server:
 * SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
 * SMTP_FROM_EMAIL, SMTP_FROM_NAME.
 */

function envValue($name, $default = '') {
    $value = getenv($name);
    return $value === false ? $default : $value;
}

function sendEmail($to, $subject, $htmlBody, $textBody = '', $replyTo = '', $bcc = '') {
    $host = envValue('SMTP_HOST', 'smtp.postmarkapp.com');
    $port = (int) envValue('SMTP_PORT', '587');
    $username = envValue('SMTP_USERNAME');
    $password = envValue('SMTP_PASSWORD');
    $from = envValue('SMTP_FROM_EMAIL', 'pohm@intellismartgroup.com');
    $fromName = envValue('SMTP_FROM_NAME', 'Intellismart Group');

    if (!$username || !$password) {
        return ['success' => false, 'error' => 'SMTP credentials not configured'];
    }

    $socket = @fsockopen($host, $port, $errno, $errstr, 30);
    if (!$socket) {
        return ['success' => false, 'error' => "Connection failed: $errstr ($errno)"];
    }

    stream_set_timeout($socket, 30);
    $fail = function ($message) use ($socket) {
        fclose($socket);
        return ['success' => false, 'error' => $message];
    };

    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '220') {
        return $fail("Server greeting failed: $response");
    }

    fwrite($socket, "EHLO " . gethostname() . "\r\n");
    while ($line = fgets($socket, 1024)) {
        if (substr($line, 3, 1) === ' ') {
            break;
        }
    }

    fwrite($socket, "STARTTLS\r\n");
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '220') {
        return $fail("STARTTLS failed: $response");
    }

    if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        return $fail('TLS encryption failed');
    }

    fwrite($socket, "EHLO " . gethostname() . "\r\n");
    while ($line = fgets($socket, 1024)) {
        if (substr($line, 3, 1) === ' ') {
            break;
        }
    }

    fwrite($socket, "AUTH LOGIN\r\n");
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '334') {
        return $fail("AUTH LOGIN failed: $response");
    }

    fwrite($socket, base64_encode($username) . "\r\n");
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '334') {
        return $fail("Username rejected: $response");
    }

    fwrite($socket, base64_encode($password) . "\r\n");
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '235') {
        return $fail("Authentication failed: $response");
    }

    $recipients = array_filter(array_merge([$to], is_array($bcc) ? $bcc : [$bcc]));

    fwrite($socket, "MAIL FROM:<$from>\r\n");
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '250') {
        return $fail("MAIL FROM failed: $response");
    }

    foreach ($recipients as $recipient) {
        fwrite($socket, "RCPT TO:<$recipient>\r\n");
        $response = fgets($socket, 1024);
        if (substr($response, 0, 3) !== '250') {
            return $fail("RCPT TO failed: $response");
        }
    }

    fwrite($socket, "DATA\r\n");
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '354') {
        return $fail("DATA failed: $response");
    }

    $boundary = md5(uniqid((string) time(), true));
    $message = "MIME-Version: 1.0\r\n";
    $message .= "From: $fromName <$from>\r\n";
    $message .= "To: $to\r\n";
    if ($replyTo) {
        $message .= "Reply-To: $replyTo\r\n";
    }
    $message .= "Subject: $subject\r\n";
    $message .= "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n\r\n";

    if ($textBody) {
        $message .= "--$boundary\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $message .= $textBody . "\r\n\r\n";
    }

    $message .= "--$boundary\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $message .= $htmlBody . "\r\n\r\n";
    $message .= "--$boundary--\r\n.\r\n";

    fwrite($socket, $message);
    $response = fgets($socket, 1024);
    if (substr($response, 0, 3) !== '250') {
        return $fail("Message send failed: $response");
    }

    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    return ['success' => true, 'method' => 'smtp'];
}
?>
