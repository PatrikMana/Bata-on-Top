<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'service' => 'Bata on Top API',
    'status' => 'ok',
]));
