<?php

namespace App\Http\Controllers;

use App\Models\Run;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RunController extends Controller
{
    private const ACTIVE_RUN_TTL_SECONDS = 15;
    private const LEADERBOARD_DEFAULT_LIMIT = 10;
    private const LEADERBOARD_MAX_LIMIT = 100;

    public function start(Request $request): JsonResponse
    {
        $this->deleteExpiredActiveRuns();

        $validated = $request->validate([
            'playerName' => ['required', 'string', 'min:2', 'max:64'],
            'mapName' => ['required', 'string', 'max:128'],
        ]);

        $runToken = Str::random(64);
        $now = now();

        $run = Run::create([
            'player_name' => trim($validated['playerName']),
            'map_name' => trim($validated['mapName']),
            'status' => Run::STATUS_ACTIVE,
            'run_token_hash' => hash('sha256', $runToken),
            'started_at' => $now,
            'last_seen_at' => $now,
        ]);

        return response()->json([
            'runId' => $run->id,
            'runToken' => $runToken,
            'startedAt' => $run->started_at?->toISOString(),
        ], 201);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $this->deleteExpiredActiveRuns();

        $run = $this->findActiveRunForRequest($request);
        $run->forceFill([
            'last_seen_at' => now(),
        ])->save();

        return response()->json([
            'runId' => $run->id,
            'status' => 'ACTIVE',
            'lastSeenAt' => $run->last_seen_at?->toISOString(),
        ]);
    }

    public function abort(Request $request): JsonResponse
    {
        $this->deleteExpiredActiveRuns();

        $run = $this->findActiveRunForRequest($request);
        $run->delete();

        return response()->json([
            'runId' => $run->id,
            'status' => 'ABORTED',
        ]);
    }

    public function finish(Request $request): JsonResponse
    {
        $this->deleteExpiredActiveRuns();

        $finishedRun = DB::transaction(function () use ($request) {
            $run = $this->findActiveRunForRequest($request, lockForUpdate: true);
            $finishedAt = now();
            $timeMs = max(0, $run->started_at->diffInMilliseconds($finishedAt));

            $existingRuns = Run::query()
                ->finished()
                ->where('player_name', $run->player_name)
                ->where('map_name', $run->map_name)
                ->orderBy('time_ms')
                ->orderBy('finished_at')
                ->lockForUpdate()
                ->get();

            $bestExistingRun = $existingRuns->first();

            if ($bestExistingRun && $bestExistingRun->time_ms <= $timeMs) {
                $run->delete();

                $existingRuns
                    ->slice(1)
                    ->each(fn (Run $existingRun) => $existingRun->delete());

                return [
                    'runId' => $run->id,
                    'status' => 'FINISHED',
                    'timeMs' => $timeMs,
                    'finishedAt' => $finishedAt,
                    'personalBest' => false,
                    'leaderboardRunId' => $bestExistingRun->id,
                ];
            }

            $existingRuns->each(fn (Run $existingRun) => $existingRun->delete());

            $run->forceFill([
                'status' => Run::STATUS_FINISHED,
                'time_ms' => $timeMs,
                'finished_at' => $finishedAt,
                'last_seen_at' => $finishedAt,
                'run_token_hash' => null,
            ])->save();

            return [
                'runId' => $run->id,
                'status' => 'FINISHED',
                'timeMs' => $run->time_ms,
                'finishedAt' => $run->finished_at,
                'personalBest' => true,
                'leaderboardRunId' => $run->id,
            ];
        });

        return response()->json([
            'runId' => $finishedRun['runId'],
            'status' => $finishedRun['status'],
            'timeMs' => $finishedRun['timeMs'],
            'finishedAt' => $finishedRun['finishedAt']->toISOString(),
            'personalBest' => $finishedRun['personalBest'],
            'leaderboardRunId' => $finishedRun['leaderboardRunId'],
        ]);
    }

    public function leaderboard(Request $request): JsonResponse
    {
        $this->deleteExpiredActiveRuns();

        $validated = $request->validate([
            'mapName' => ['sometimes', 'string', 'max:128'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:'.self::LEADERBOARD_MAX_LIMIT],
        ]);

        $limit = $validated['limit'] ?? self::LEADERBOARD_DEFAULT_LIMIT;

        $runs = Run::query()
            ->finished()
            ->when(
                isset($validated['mapName']),
                fn ($query) => $query->where('map_name', $validated['mapName']),
            )
            ->orderBy('time_ms')
            ->orderBy('finished_at')
            ->limit($limit)
            ->get();

        return response()->json(
            $runs->map(fn (Run $run) => [
                'id' => $run->id,
                'playerName' => $run->player_name,
                'mapName' => $run->map_name,
                'timeMs' => $run->time_ms,
                'finishedAt' => $run->finished_at?->toISOString(),
            ])->values(),
        );
    }

    private function findActiveRunForRequest(Request $request, bool $lockForUpdate = false): Run
    {
        $validated = $request->validate([
            'runId' => ['required', 'integer', 'min:1'],
            'runToken' => ['required', 'string', 'size:64'],
        ]);

        $query = Run::query()->active()->whereKey($validated['runId']);

        if ($lockForUpdate) {
            $query->lockForUpdate();
        }

        $run = $query->first();

        if (! $run || ! $run->hasToken($validated['runToken'])) {
            throw ValidationException::withMessages([
                'runId' => 'Run is not active or token is invalid.',
            ]);
        }

        return $run;
    }

    private function deleteExpiredActiveRuns(): void
    {
        Run::deleteExpiredActiveRuns(self::ACTIVE_RUN_TTL_SECONDS);
    }
}
