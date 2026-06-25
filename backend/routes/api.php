<?php

use App\Http\Controllers\RunController;
use Illuminate\Support\Facades\Route;

Route::options('/{any}', fn () => response()->noContent())->where('any', '.*');

Route::post('/runs/start', [RunController::class, 'start'])
    ->middleware('throttle:api-start');

Route::middleware('throttle:api-write')->group(function () {
    Route::post('/runs/heartbeat', [RunController::class, 'heartbeat']);
    Route::post('/runs/abort', [RunController::class, 'abort']);
    Route::post('/runs/finish', [RunController::class, 'finish']);
});

Route::get('/leaderboard', [RunController::class, 'leaderboard'])
    ->middleware('throttle:api-read');
