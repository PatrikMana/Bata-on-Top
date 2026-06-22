<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\Run;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('runs:cleanup-expired {--ttl=15}', function () {
    $deletedRuns = Run::deleteExpiredActiveRuns((int) $this->option('ttl'));

    $this->info("Deleted {$deletedRuns} expired active run(s).");
})->purpose('Delete active runs whose clients stopped sending heartbeats');
