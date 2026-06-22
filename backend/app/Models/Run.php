<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class Run extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_FINISHED = 'finished';

    protected $fillable = [
        'player_name',
        'map_name',
        'time_ms',
        'status',
        'run_token_hash',
        'started_at',
        'last_seen_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'time_ms' => 'integer',
            'started_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeFinished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FINISHED);
    }

    public function hasToken(string $runToken): bool
    {
        return hash_equals($this->run_token_hash ?? '', hash('sha256', $runToken));
    }

    public static function deleteExpiredActiveRuns(int $ttlSeconds): int
    {
        return self::query()
            ->active()
            ->where('last_seen_at', '<', Carbon::now()->subSeconds($ttlSeconds))
            ->delete();
    }
}
