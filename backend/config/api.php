<?php

return [
    'frontend_origin' => env('FRONTEND_URL', 'http://localhost:5173'),
    'require_origin' => (bool) env('API_REQUIRE_ORIGIN', false),
];
